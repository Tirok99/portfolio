# Supabase Storage — `public-media`

Public bucket. Read: anyone, by public URL. Write: only the serverless
functions (`api/admin/upload`) using the service-role key.

```
public-media/
  projects/   project card images   projects/<id>-<8hex>.<ext>
  services/   service card icons    services/<id>-<8hex>.<ext>
```

- Size limit 2 MB; MIME `image/png, image/jpeg, image/webp`.
- SVG is intentionally excluded from uploads (inline-script risk on the Storage origin). The operator should also remove `image/svg+xml` from the bucket's Allowed MIME types.
- Repo assets under `public/assets/**` are NOT stored here; seeded rows point at
  `/assets/...` paths and are served by the app itself.
- Object names carry a random 8-hex suffix so replacing an image busts caches.
