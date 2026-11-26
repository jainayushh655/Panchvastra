"""
Revert `optimize_existing_images` using the manifest it wrote.

────────────────────────────────────────────────────────────────────────────────
WHERE THIS FILE GOES
────────────────────────────────────────────────────────────────────────────────
Same place as the command it reverses:

    <django_app>/management/commands/rollback_optimized_images.py

────────────────────────────────────────────────────────────────────────────────
WHY THIS IS ONLY A DATABASE OPERATION
────────────────────────────────────────────────────────────────────────────────
`optimize_existing_images` never deletes or overwrites an original — it writes the WebP
under a new key and repoints the row. So every original object is still in the bucket,
byte for byte, and reverting means writing the old value back into the one field that
changed. Nothing is downloaded, nothing is re-uploaded, and the rollback cannot fail
because a file is missing.

The new WebP objects are left in place too. They are small, they are unreferenced after
this runs, and deleting them is a separate decision — a rollback should restore service,
not destroy evidence of what went wrong.

────────────────────────────────────────────────────────────────────────────────
USAGE
────────────────────────────────────────────────────────────────────────────────
Check what would be restored:

    python manage.py rollback_optimized_images --manifest ./manifest-products.jsonl

Restore:

    python manage.py rollback_optimized_images --manifest ./manifest-products.jsonl --apply

Rows are restored in REVERSE manifest order, so a partially-completed forward run unwinds
in the exact opposite order to the one it was applied in.
"""

from __future__ import annotations

import json
import os

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Restore image references changed by optimize_existing_images. Dry run unless --apply."

    def add_arguments(self, parser):
        parser.add_argument("--manifest", required=True, help="Path to the JSONL manifest.")
        parser.add_argument(
            "--model",
            required=True,
            help='Model the manifest was written for, as "app_label.ModelName".',
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually write. Without this the command only reports what it would restore.",
        )

    def handle(self, *args, **options):
        path = options["manifest"]
        if not os.path.exists(path):
            raise CommandError(f"Manifest not found: {path}")

        try:
            model = apps.get_model(options["model"])
        except Exception as exc:
            raise CommandError(f"Could not resolve --model {options['model']!r}: {exc}")

        records = []
        with open(path, encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise CommandError(f"Manifest line {line_number} is not valid JSON: {exc}")

        apply_changes = options["apply"]
        mode = "APPLY" if apply_changes else "DRY RUN (nothing will be written)"
        self.stdout.write(self.style.MIGRATE_HEADING(f"{mode} — restoring {len(records)} rows"))

        restored = 0
        missing = 0
        errors = 0

        # Reverse order: a forward run that stopped halfway unwinds in the exact opposite
        # order to the one it was applied in.
        for record in reversed(records):
            pk = record.get("pk")
            field = record.get("field")
            old_value = record.get("old_value")

            if not field or old_value in (None, ""):
                self.stdout.write(self.style.WARNING(f"  pk={pk}: incomplete record, skipped"))
                continue

            try:
                obj = model.objects.get(pk=pk)
            except model.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  pk={pk}: row no longer exists, skipped"))
                missing += 1
                continue

            current = getattr(obj, field, None)
            current = str(getattr(current, "name", current) or "")

            if current == old_value:
                self.stdout.write(f"  pk={pk}: already at original value, nothing to do")
                continue

            if not apply_changes:
                self.stdout.write(f"  pk={pk}: would restore -> {old_value}")
                restored += 1
                continue

            try:
                # Only the image field, exactly as the forward command did.
                with transaction.atomic():
                    setattr(obj, field, old_value)
                    obj.save(update_fields=[field])
                restored += 1
                self.stdout.write(f"  pk={pk}: restored")
            except Exception as exc:
                errors += 1
                self.stdout.write(self.style.ERROR(f"  pk={pk}: ERROR — {exc}"))

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Totals"))
        self.stdout.write(f"  restored : {restored}")
        self.stdout.write(f"  missing  : {missing}")
        self.stdout.write(f"  errors   : {errors}")

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("DRY RUN — nothing was written. Re-run with --apply."))
