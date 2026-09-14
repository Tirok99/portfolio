-- ============================================================================
--  ONVORX — allow image/svg+xml uploads to the public-media bucket.
--
--  Run once in the Supabase SQL Editor. Idempotent (sets the exact array
--  every time, safe to re-run).
--
--  Context: the public-media Storage bucket was originally configured with
--  an "Allowed MIME types" restriction of image/png, image/jpeg, image/webp
--  only — SVG was deliberately excluded at bucket creation time (documented
--  in supabase/STORAGE.md) because raw SVG can carry an inline <script> or
--  onload="" handler, which would execute if the object were ever opened
--  directly on the Storage origin.
--
--  The application (api/_lib/adminUploadHandler.ts) now sanitizes every
--  uploaded SVG server-side with DOMPurify before it's ever written to
--  Storage, closing that risk at the application layer — but the bucket's
--  own MIME allowlist is enforced by Supabase Storage's API independently
--  of anything the application does, so uploads were still rejected with a
--  generic 500 until the bucket itself is told to accept the type too.
-- ============================================================================

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id = 'public-media';
