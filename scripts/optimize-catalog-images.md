# Catalogue image optimisation — measurements, migration and caching

Measured against the live API and storage host on **2026-11-26**.

> **Correction to the first version of this report.** It said *16 images, 30.8 MB*. That
> came from `/v1/products_management/` (the LIST endpoint), which returns one
> `primary_image` per product. Walking each product's DETAIL endpoint shows every variant
> image. The real figure is **98 product images**, and with category and hero artwork the
> catalogue is **103 images totalling ~176.6 MB** — roughly 5.7x the original estimate.

---

## 1. What is actually in storage

| Prefix | Images | Total | Average | Format |
|---|---|---|---|---|
| `panchvastra/products/` | 98 | **167.5 MB** | 1,751 KB | 100% PNG |
| `panchvastra/categories/` | 3 | **5.86 MB** | 2,002 KB | 100% PNG |
| `panchvastra/auth-carousel/` | 2 | **3.24 MB** | 1,658 KB | PNG + JPEG |
| **Total** | **103** | **~176.6 MB** | | |

Largest single image: 2,499 KB. Smallest: 579 KB.

Where these land on the storefront:

- **Product images** — `ProductCard` on the homepage and Shop, and the product page gallery.
- **Category images** — `HomeCategoryGrid`, on the homepage's first screen. 5.86 MB for three tiles.
- **Hero carousel** — `HeroCarousel`, the homepage **LCP element**. 3.24 MB for two slides.

### Three distinct problems

1. **Everything is PNG.** PNG is lossless; photographic garment shots are the content it
   stores worst. The same images as WebP are ~150 KB — about a tenth of the bytes, with
   no visible difference at the sizes they are displayed.

2. **No `Cache-Control` header at all.** Verified on every one of the 103 objects. A
   returning shopper re-validates, and frequently re-downloads, the whole catalogue.

3. **The storage host does no transformation and no content negotiation.** Verified:
   `?width=200` is ignored and `Accept: image/webp` still returns the PNG. The bytes
   stored are the bytes shipped, so the only fix is to store better ones.

### Storage host fingerprint

```
GET https://storage.panchvastra.com/<key>
  X-Amz-Request-Id: <uuid4>          # S3-compatible API
  X-Request-Id:     <same uuid4>
  (no Server header, no x-amz-id-2)
404 body: <Error><Code>NoSuchKey</Code><Message>…</Message></Error>
TLS: Let's Encrypt, CN=storage.panchvastra.com
```

**S3-compatible, but not AWS S3** — AWS always returns `x-amz-id-2`, and both AWS and
MinIO return a richer error document (`<Key>`, `<BucketName>`, `<Resource>`,
`<RequestId>`, `<HostId>`). The stripped-down error body plus the absent `Server` header
points at a **self-hosted S3 gateway** (SeaweedFS, Garage, Zenko or similar) behind a
reverse proxy, on your own domain with a Let's Encrypt certificate.

The practical consequence: **there is probably no vendor dashboard to click.** The
caching fix below is therefore written against the S3 API and the Django settings, which
work regardless of which implementation is underneath.

### Object keys are immutable — confirmed

All 103 keys follow `<prefix>/<uuid4>_<original filename>`, and all 103 UUIDs are
distinct. A replaced image is written under a fresh UUID, so no key's bytes can change.
**This is what makes `immutable` caching safe**, and it was verified rather than assumed.

One incidental finding: **54 of the 98 product keys contain literal spaces**
(`…_Cozy Cream Hoodie Portrait.png`). Browsers percent-encode these automatically in
`<img src>`, so the site works — but it is fragile anywhere else, and any script touching
these URLs must encode them. Not worth renaming existing objects; worth slugifying
filenames on upload in the backend.

---

## 2. What is already fixed, in the frontend

New uploads are re-encoded **in the browser** before being sent —
`src/admin/utils/imageCompression.ts`. Decode → EXIF-correct → downscale → WebP q82.

Covered upload paths:

| Admin screen | Cap | Note |
|---|---|---|
| Products → variant images | 1600px | the 98-image set |
| Auth Carousel (hero) | 1920px | full-bleed artwork, so a larger cap |
| Categories | 1600px | homepage tiles |
| Custom Options (garment / print type) | 1600px | Custom Piece builder |

Measured in the admin panel: **4 images, 7.80 MB → 0.59 MB (92% smaller).**

It never blocks a save — every failure path (decode, canvas, encode, or a result that
isn't smaller) returns the original file. Animated GIFs are skipped so their frames
survive.

**This does not touch the 103 files already in storage.** That is what the rest of this
document is for.

---

## 3. Migrating the existing images

Two Django management commands are provided, ready to drop in:

```
scripts/backend/optimize_existing_images.py
scripts/backend/rollback_optimized_images.py
```

They live in this repo only because the Django backend is a separate repository that is
not checked out on this machine. Copy them to:

```
<django_app>/management/commands/
```

creating `management/` and `management/commands/` with empty `__init__.py` files if
needed.

### Safety model

- **Dry run is the default.** Nothing is written without `--apply`.
- **Originals are never deleted or overwritten.** The WebP is written under a *new* UUID
  key and the row is repointed. Every original stays in the bucket.
- **`--apply` requires `--manifest`.** An unrecorded bulk update is refused, because it
  cannot be rolled back. The manifest is flushed per row, so an interrupted run still
  covers everything it changed.
- **Rollback is database-only** and therefore cannot fail on a missing file.
- **One row per transaction, `update_fields=[field]`.** Prices, stock, variants and every
  other column are untouchable by this command, whatever the model's `save()` does.
- **Failures are isolated** — a bad object is recorded and skipped, never aborting the run.

Encoding matches the frontend exactly: aspect preserved, never upscaled (`thumbnail`),
EXIF orientation applied via `ImageOps.exif_transpose`, alpha preserved for RGBA/LA/
palette-with-transparency sources, animated sources skipped, and any re-encode that comes
out *larger* is discarded.

### Commands to run

Replace `catalog.ProductImage` / `image_url` with your real model and field — the command
has no defaults and will refuse to run without them.

```bash
# 1. Dry run. No writes. Reports before/after and totals.
python manage.py optimize_existing_images \
    --model catalog.ProductImage --field image_url

# 2. Canary: three rows, for real. Check them on the site.
python manage.py optimize_existing_images \
    --model catalog.ProductImage --field image_url \
    --limit 3 --manifest ./manifest-products.jsonl --apply

# 3. If the canary looks wrong, undo it.
python manage.py rollback_optimized_images \
    --model catalog.ProductImage --manifest ./manifest-products.jsonl --apply

# 4. The rest, once happy.
python manage.py optimize_existing_images \
    --model catalog.ProductImage --field image_url \
    --manifest ./manifest-products-full.jsonl --apply

# 5. Categories, and the hero at a larger cap.
python manage.py optimize_existing_images \
    --model catalog.Category --field image \
    --manifest ./manifest-categories.jsonl --apply

python manage.py optimize_existing_images \
    --model catalog.AuthCarouselImage --field image \
    --max-edge 1920 --manifest ./manifest-hero.jsonl --apply
```

Expected outcome, based on the compression already measured in the browser on the same
imagery: **~176.6 MB → roughly 15-20 MB.**

> **Not executed.** No Python interpreter exists on this machine, so these commands have
> never been run or even imported. Treat the dry run as the first real test, on staging
> if you have one. Take a database backup before step 2 regardless — the rollback covers
> this command's own writes, not a mistake in the model/field arguments.

---

## 4. Setting `Cache-Control`

Target header, for all three prefixes:

```
Cache-Control: public, max-age=31536000, immutable
```

Safe here **because the keys are immutable** (section 1). Before applying, confirm one
thing in the backend that cannot be checked from outside:

> **Does any code path write to an existing key?** If an "edit image" flow ever does
> `storage.save(same_key, new_file)` or a boto3 `put_object` reusing a key, `immutable`
> will serve stale bytes for a year. Everything observable says keys are per-upload UUIDs,
> but the upload code is the authority. If any path does overwrite, use
> `public, max-age=31536000` without `immutable`, or fix the path first.

### 4a. The durable fix — set it at upload time

This is the one that matters, because it covers every future upload including the ones
the migration writes. If the backend uses **django-storages**, in `settings.py`:

```python
AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": "public, max-age=31536000, immutable",
}
```

If it calls **boto3 directly**, add the same to each upload:

```python
s3.put_object(
    Bucket=bucket,
    Key=key,
    Body=data,
    ContentType=content_type,
    CacheControl="public, max-age=31536000, immutable",
)
```

### 4b. Backfill the 103 existing objects

An S3 copy onto itself with `REPLACE` rewrites metadata without re-uploading bytes:

```bash
aws --endpoint-url https://storage.panchvastra.com \
    s3 cp s3://panchvastra/products/ s3://panchvastra/products/ \
    --recursive \
    --metadata-directive REPLACE \
    --cache-control "public, max-age=31536000, immutable" \
    --content-type image/png
```

**Careful:** `--content-type` is forced here because `REPLACE` drops all existing
metadata, and a prefix holding mixed formats would end up mislabelled. The
`auth-carousel/` prefix contains both PNG and JPEG, so do that one per-object with boto3
rather than with a recursive `cp`:

```python
import boto3
s3 = boto3.client("s3", endpoint_url="https://storage.panchvastra.com")

for key in keys:                      # one prefix at a time
    head = s3.head_object(Bucket="panchvastra", Key=key)
    s3.copy_object(
        Bucket="panchvastra",
        Key=key,
        CopySource={"Bucket": "panchvastra", "Key": key},
        MetadataDirective="REPLACE",
        ContentType=head["ContentType"],          # preserved, not guessed
        CacheControl="public, max-age=31536000, immutable",
    )
```

Run 4b **after** the migration in section 3, so you are not paying to rewrite metadata on
objects that are about to be superseded.

### 4c. Check the reverse proxy

Something in front of the gateway is stripping the `Server` header, so a proxy exists. If
it also strips or rewrites `Cache-Control`, the steps above will appear to do nothing.
Verify with:

```bash
curl -sI "https://storage.panchvastra.com/<some-key>" | grep -i cache-control
```

If that stays empty after 4b, the header is being set on the object but removed in
transit — fix it in the proxy config (nginx: do not `proxy_hide_header Cache-Control`;
add `proxy_pass_header Cache-Control`).

---

## 5. What needs manual action

| # | Action | Who | Risk |
|---|---|---|---|
| 1 | Copy both commands into the Django repo | backend | none |
| 2 | Identify the real model/field names for product, category and carousel images | backend | none |
| 3 | Confirm no upload path overwrites an existing key | backend | **blocks 4** |
| 4 | Database backup, then dry run → canary → full migration | backend | medium, reversible |
| 5 | Add `AWS_S3_OBJECT_PARAMETERS` and redeploy | backend | low |
| 6 | Backfill `Cache-Control` on existing objects | infra | low |
| 7 | Verify the proxy is not stripping the header | infra | low |
| 8 | Slugify upload filenames (the 54 keys with spaces) | backend | low, improvement only |
