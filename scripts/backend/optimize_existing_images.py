"""
Re-encode catalogue imagery that is ALREADY in storage, safely and reversibly.

────────────────────────────────────────────────────────────────────────────────
WHERE THIS FILE GOES
────────────────────────────────────────────────────────────────────────────────
This file is NOT part of the React frontend. It is written here because the Django
backend is a separate repository that is not checked out on this machine. Drop it into
the backend at:

    <django_app>/management/commands/optimize_existing_images.py

(creating `management/` and `management/commands/`, each with an empty `__init__.py`,
if they do not already exist), then run it from the backend with `python manage.py`.

────────────────────────────────────────────────────────────────────────────────
WHAT IT DOES
────────────────────────────────────────────────────────────────────────────────
For every row of a named model: download the current image, re-encode it as WebP
(longest edge capped, aspect preserved, never upscaled), upload it under a NEW object
key, and point the row at the new key.

────────────────────────────────────────────────────────────────────────────────
THE SAFETY MODEL, WHICH IS THE WHOLE POINT
────────────────────────────────────────────────────────────────────────────────
1. DRY RUN IS THE DEFAULT. Nothing is written without `--apply`. There is no flag that
   makes a destructive run the default, and `--apply` cannot be implied by anything else.

2. THE ORIGINAL OBJECT IS NEVER DELETED OR OVERWRITTEN. The WebP goes to a new key, so
   every original stays exactly where it is. Rollback is therefore a database-only
   operation and can never fail because of a missing file. Reclaiming the old objects is
   a deliberate, separate decision to make later, once the new ones have been live long
   enough to trust.

3. EVERY CHANGE IS RECORDED. `--manifest` writes one JSON record per row before and
   after. `rollback_optimized_images.py` replays it in reverse. Without a manifest path
   the command refuses to apply, because an unrecorded bulk update is not reversible.

4. ONE ROW PER TRANSACTION, and only the image field is written. `update_fields` is
   passed explicitly, so this command cannot touch a price, a stock count, a variant or
   anything else even if a model has `save()` side effects on other fields.

5. FAILURES ARE ISOLATED. A row that cannot be downloaded, decoded or encoded is
   recorded as an error and skipped. One bad object never aborts the run or leaves a
   half-written row.

────────────────────────────────────────────────────────────────────────────────
USAGE
────────────────────────────────────────────────────────────────────────────────
Dry run, everything, no writes:

    python manage.py optimize_existing_images \
        --model catalog.ProductImage --field image_url

Canary — apply to three rows only:

    python manage.py optimize_existing_images \
        --model catalog.ProductImage --field image_url \
        --limit 3 --manifest ./manifest-products.jsonl --apply

Hero artwork, which is full-bleed and gets a larger cap:

    python manage.py optimize_existing_images \
        --model catalog.AuthCarouselImage --field image \
        --max-edge 1920 --manifest ./manifest-hero.jsonl --apply

The `--model` and `--field` values MUST be supplied; there is no default, so the command
cannot be pointed at the wrong table by accident.
"""

from __future__ import annotations

import io
import json
import os
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Iterable, Optional
from urllib.parse import urljoin, urlparse, unquote, quote

from django.apps import apps
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

try:
    from PIL import Image, ImageOps
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "Pillow is required: pip install Pillow"
    ) from exc


# Matches the browser-side encoder in the frontend
# (src/admin/utils/imageCompression.ts). Keep the two in step: if one changes, new
# uploads and migrated originals stop looking alike.
DEFAULT_MAX_EDGE = 1600
DEFAULT_QUALITY = 82

# Formats whose animation would be destroyed by a single-frame re-encode.
ANIMATED_FORMATS = {"GIF", "WEBP", "APNG"}


@dataclass
class RowResult:
    pk: Any
    field: str
    old_value: str
    new_value: Optional[str]
    old_bytes: int
    new_bytes: int
    status: str  # "optimized" | "skipped" | "error"
    detail: str = ""


class Command(BaseCommand):
    help = "Re-encode existing stored images as WebP, reversibly. Dry run unless --apply."

    def add_arguments(self, parser):
        parser.add_argument(
            "--model",
            required=True,
            help='Model holding the images, as "app_label.ModelName".',
        )
        parser.add_argument(
            "--field",
            required=True,
            help="Name of the ImageField/FileField, or the URL/Char field holding the image.",
        )
        parser.add_argument(
            "--max-edge",
            type=int,
            default=DEFAULT_MAX_EDGE,
            help=f"Longest edge to keep (default {DEFAULT_MAX_EDGE}; use 1920 for hero artwork).",
        )
        parser.add_argument(
            "--quality",
            type=int,
            default=DEFAULT_QUALITY,
            help=f"WebP quality (default {DEFAULT_QUALITY}).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N rows. 0 means all. Use a small number for a canary run.",
        )
        parser.add_argument(
            "--manifest",
            default="",
            help="Path to write a JSONL record of every change. REQUIRED with --apply.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually write. Without this the command only reports what it would do.",
        )

    # ---------------------------------------------------------------- entry point

    def handle(self, *args, **options):
        model = self._load_model(options["model"])
        field_name = options["field"]
        self._check_field(model, field_name)

        apply_changes: bool = options["apply"]
        manifest_path: str = options["manifest"]

        if apply_changes and not manifest_path:
            raise CommandError(
                "--apply requires --manifest. A bulk update with no record of what changed "
                "cannot be rolled back, so it is refused."
            )
        if manifest_path and os.path.exists(manifest_path):
            raise CommandError(
                f"Manifest {manifest_path!r} already exists. Refusing to overwrite the only "
                "record of a previous run — choose another path."
            )

        queryset = model.objects.exclude(**{f"{field_name}__isnull": True}).order_by("pk")
        if options["limit"]:
            queryset = queryset[: options["limit"]]

        mode = "APPLY" if apply_changes else "DRY RUN (nothing will be written)"
        self.stdout.write(self.style.MIGRATE_HEADING(f"{mode} — {options['model']}.{field_name}"))
        self.stdout.write(
            f"max_edge={options['max_edge']} quality={options['quality']} rows={queryset.count()}\n"
        )

        results: list[RowResult] = []

        # Opened only for a real run. A dry run given a --manifest path must not CREATE the
        # file: an empty manifest left behind would then trip the
        # "refusing to overwrite" guard above and block the apply it was preparing for.
        manifest = open(manifest_path, "a", encoding="utf-8") if (manifest_path and apply_changes) else None

        try:
            for obj in queryset.iterator():
                result = self._process_row(
                    obj,
                    field_name=field_name,
                    max_edge=options["max_edge"],
                    quality=options["quality"],
                    apply_changes=apply_changes,
                )
                results.append(result)

                if manifest and result.status == "optimized" and apply_changes:
                    manifest.write(json.dumps(asdict(result)) + "\n")
                    # Flushed per row: an interrupted run must still leave a manifest that
                    # covers every change it actually made.
                    manifest.flush()

                self._report_row(result)
        finally:
            if manifest:
                manifest.close()

        self._report_totals(results, apply_changes, manifest_path)

    # ------------------------------------------------------------------ per row

    def _process_row(self, obj, *, field_name, max_edge, quality, apply_changes) -> RowResult:
        raw = getattr(obj, field_name)
        old_value = self._field_to_str(raw)

        if not old_value:
            return RowResult(obj.pk, field_name, "", None, 0, 0, "skipped", "empty field")

        key = self._storage_key(raw, old_value)

        try:
            source = self._read_object(raw, key)
        except Exception as exc:
            return RowResult(obj.pk, field_name, old_value, None, 0, 0, "error", f"read failed: {exc}")

        old_bytes = len(source)

        try:
            encoded = self._encode(source, max_edge=max_edge, quality=quality)
        except SkipImage as exc:
            return RowResult(obj.pk, field_name, old_value, None, old_bytes, old_bytes, "skipped", str(exc))
        except Exception as exc:
            return RowResult(obj.pk, field_name, old_value, None, old_bytes, 0, "error", f"encode failed: {exc}")

        new_bytes = len(encoded)

        # Re-encoding that makes a file LARGER is worse than leaving it alone. This also
        # covers anything already stored efficiently.
        if new_bytes >= old_bytes:
            return RowResult(
                obj.pk, field_name, old_value, None, old_bytes, old_bytes,
                "skipped", f"re-encode not smaller ({new_bytes} >= {old_bytes})",
            )

        new_key = self._new_key(key)

        if not apply_changes:
            return RowResult(obj.pk, field_name, old_value, new_key, old_bytes, new_bytes, "optimized", "dry run")

        try:
            stored_name = default_storage.save(new_key, ContentFile(encoded))
        except Exception as exc:
            return RowResult(obj.pk, field_name, old_value, None, old_bytes, new_bytes, "error", f"upload failed: {exc}")

        new_value = self._build_new_value(raw, old_value, stored_name)

        try:
            # Only this field is written. `update_fields` makes that a guarantee rather
            # than an intention: no other column can be touched by this save, whatever
            # the model's save() does.
            #
            # `new_value` is already the right shape for either field type —
            # `_build_new_value` returns the storage name for a FileField and a rebuilt
            # absolute URL for a URL field.
            with transaction.atomic():
                setattr(obj, field_name, new_value)
                obj.save(update_fields=[field_name])
        except Exception as exc:
            return RowResult(obj.pk, field_name, old_value, new_value, old_bytes, new_bytes, "error", f"db write failed: {exc}")

        return RowResult(obj.pk, field_name, old_value, new_value, old_bytes, new_bytes, "optimized")

    # ------------------------------------------------------------------ encoding

    def _encode(self, data: bytes, *, max_edge: int, quality: int) -> bytes:
        """
        Decode → honour EXIF orientation → downscale → WebP.

        Raises SkipImage for anything that must be left alone.
        """
        try:
            image = Image.open(io.BytesIO(data))
        except Exception as exc:
            raise SkipImage(f"not a decodable image ({exc})")

        # An animated source would lose every frame but the first.
        if getattr(image, "is_animated", False):
            raise SkipImage(f"animated {image.format} — left untouched")
        if image.format in ANIMATED_FORMATS and getattr(image, "n_frames", 1) > 1:
            raise SkipImage(f"multi-frame {image.format} — left untouched")

        # A photo shot on a phone carries its rotation in EXIF rather than in the pixels.
        # Without this, re-encoding bakes in the UNROTATED pixels and the image appears
        # sideways — the classic silent corruption of a bulk image migration.
        image = ImageOps.exif_transpose(image)

        # Transparency is preserved: WebP supports alpha, so an RGBA/LA/palette-with-
        # transparency source stays RGBA. Everything else becomes RGB, which avoids
        # writing a pointless alpha channel for an opaque photograph.
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            image = image.convert("RGBA")
        elif image.mode != "RGB":
            image = image.convert("RGB")

        # `thumbnail` preserves aspect ratio and NEVER upscales — a 900px source stays
        # 900px rather than being blown up to the cap.
        image.thumbnail((max_edge, max_edge), Image.LANCZOS)

        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", quality=quality, method=6)
        return buffer.getvalue()

    # ------------------------------------------------------------ storage helpers

    def _field_to_str(self, raw) -> str:
        """A FileField renders as its storage name; a URL/Char field as its own text."""
        if raw is None:
            return ""
        name = getattr(raw, "name", None)
        return str(name if name is not None else raw).strip()

    def _storage_key(self, raw, value: str) -> str:
        """
        The object key inside the bucket.

        A FileField already holds it. A URL field holds an absolute URL, whose path is
        the key — percent-decoded, because 54 of the live keys contain literal spaces and
        the stored URL encodes them.
        """
        if getattr(raw, "name", None):
            return str(raw.name)
        parsed = urlparse(value)
        if parsed.scheme:
            return unquote(parsed.path).lstrip("/")
        return value.lstrip("/")

    def _read_object(self, raw, key: str) -> bytes:
        """Reads through Django's storage, so whatever backend is configured is used."""
        if getattr(raw, "name", None):
            with raw.open("rb") as handle:
                return handle.read()
        with default_storage.open(key, "rb") as handle:
            return handle.read()

    def _new_key(self, old_key: str) -> str:
        """
        A NEW key beside the old one, never the same key.

        The existing scheme is `<uuid4>_<original name>`, which is what makes the objects
        immutable and lets them be cached forever. That property is preserved: a fresh
        UUID means the new object can never collide with, or be mistaken for, the old
        one, and no cache anywhere is holding stale bytes under this name.
        """
        directory = os.path.dirname(old_key)
        base = os.path.basename(old_key)
        stem = base.split("_", 1)[1] if "_" in base else base
        stem = os.path.splitext(stem)[0]
        return os.path.join(directory, f"{uuid.uuid4()}_{stem}.webp").replace("\\", "/")

    def _build_new_value(self, raw, old_value: str, stored_name: str) -> str:
        """
        For a FileField the caller writes `stored_name`. For a URL field the absolute URL
        is rebuilt against the ORIGINAL one, so the host and any path prefix are carried
        over exactly rather than reconstructed from settings.
        """
        if getattr(raw, "name", None):
            return stored_name

        parsed = urlparse(old_value)
        if not parsed.scheme:
            return stored_name

        root = f"{parsed.scheme}://{parsed.netloc}/"
        return urljoin(root, quote(stored_name))

    # -------------------------------------------------------------------- loading

    def _load_model(self, label: str):
        try:
            return apps.get_model(label)
        except Exception as exc:
            raise CommandError(f"Could not resolve --model {label!r}: {exc}")

    def _check_field(self, model, field_name: str):
        try:
            field = model._meta.get_field(field_name)
        except Exception as exc:
            raise CommandError(f"Model has no field {field_name!r}: {exc}")

        allowed = ("FileField", "ImageField", "CharField", "TextField", "URLField")
        kind = field.get_internal_type()
        if kind not in allowed:
            raise CommandError(
                f"Field {field_name!r} is a {kind}, which does not hold an image "
                f"reference. Expected one of: {', '.join(allowed)}."
            )

    # ------------------------------------------------------------------ reporting

    def _report_row(self, r: RowResult):
        if r.status == "optimized":
            saved = (1 - r.new_bytes / r.old_bytes) * 100 if r.old_bytes else 0
            self.stdout.write(
                f"  pk={r.pk}  {r.old_bytes / 1024:>8.0f}KB -> {r.new_bytes / 1024:>7.0f}KB  "
                f"({saved:4.1f}% smaller)  {r.detail}"
            )
        elif r.status == "skipped":
            self.stdout.write(self.style.WARNING(f"  pk={r.pk}  skipped — {r.detail}"))
        else:
            self.stdout.write(self.style.ERROR(f"  pk={r.pk}  ERROR — {r.detail}"))

    def _report_totals(self, results: Iterable[RowResult], applied: bool, manifest_path: str):
        results = list(results)
        done = [r for r in results if r.status == "optimized"]
        skipped = [r for r in results if r.status == "skipped"]
        errors = [r for r in results if r.status == "error"]

        before = sum(r.old_bytes for r in done)
        after = sum(r.new_bytes for r in done)

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Totals"))
        self.stdout.write(f"  optimized : {len(done)}")
        self.stdout.write(f"  skipped   : {len(skipped)}")
        self.stdout.write(f"  errors    : {len(errors)}")

        if done:
            self.stdout.write(
                f"  size      : {before / 1024 / 1024:.1f}MB -> {after / 1024 / 1024:.1f}MB "
                f"({(1 - after / before) * 100:.1f}% smaller, "
                f"{(before - after) / 1024 / 1024:.1f}MB saved)"
            )

        if errors:
            self.stdout.write("")
            self.stdout.write(self.style.ERROR("Errors:"))
            for r in errors:
                self.stdout.write(self.style.ERROR(f"  pk={r.pk}: {r.detail}"))

        self.stdout.write("")
        if not applied:
            self.stdout.write(self.style.WARNING(
                "DRY RUN — nothing was written. Re-run with --manifest <path> --apply to commit."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f"Applied. Manifest: {manifest_path}"))
            self.stdout.write(
                "Originals were NOT deleted. To revert: "
                f"python manage.py rollback_optimized_images --manifest {manifest_path} --apply"
            )


class SkipImage(Exception):
    """Raised for an image that must be left exactly as it is."""
