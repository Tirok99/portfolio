# Supabase Storage — `public-media`

Public bucket. Read: anyone, by public URL. Write: only the serverless
functions (`api/admin/upload`) using the service-role key.

```
public-media/
  projects/   project card images   projects/<id>-<8hex>.<ext>
  services/   service card icons    services/<id>-<8hex>.<ext>
  cards/      hero/howWork/about   cards/<id>-<8hex>.<ext>
              card icons
```

- Size limit 2 MB; MIME `image/png, image/jpeg, image/webp, image/svg+xml`.
- SVG uploads are sanitized server-side (DOMPurify, in `api/_lib/adminUploadHandler.ts`) before being written here — scripts, event-handler attributes, and other executable content are stripped, so an SVG object on this origin can't carry an inline payload. The bucket's own Allowed MIME types must also include `image/svg+xml` (see `migration-2026-09-14-allow-svg-uploads.sql`) — the application-level sanitization doesn't bypass Storage's own MIME allowlist.
- Repo assets under `public/assets/**` are NOT stored here; seeded rows point at
  `/assets/...` paths and are served by the app itself.
- Object names carry a random 8-hex suffix so replacing an image busts caches.
