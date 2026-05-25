# M6: po-attachments → signed URL migration

**Status**: code is ready, bucket flip is a manual operations step.

## Why
`po-attachments` bucket is currently `public=true` — anyone with a URL can
download the file. URLs use random 32-hex prefixes so they're not easily
guessable, but it's still security through obscurity. Migrating to private +
signed URLs (TTL 1 hr) eliminates that risk.

## What's already in place (code)
- `PoAttachment.path` field (optional, in `lib/types/db.ts`) — stores the
  storage key for new uploads
- `uploadSingleAttachmentAction` records `path` alongside `url`
- `lib/storage/attachments.ts`:
  - `resolveAttachmentUrl(att)` — returns signed URL when bucket is private
  - `extractAttachmentPath(url)` — back-extracts path from legacy public URLs
- PO detail page server-resolves URLs before passing to the client display

This means new uploads already carry `path`. Legacy attachments (no `path`)
work fine while bucket is public, and will continue to work via URL parsing
once the bucket is flipped.

## Flip steps (in order)
1. **Supabase dashboard** → Storage → `po-attachments` → Edit bucket → uncheck "Public".
   (Or CLI: `supabase storage update po-attachments --public false`.)
2. **Vercel env**: set `PO_ATTACHMENTS_PRIVATE=true` (any deployment scope).
   Triggers `resolveAttachmentUrl` to start minting signed URLs.
3. **Verify** at least one PO with attachments:
   - Open `/po/<id>` — links should now look like
     `https://<ref>.supabase.co/storage/v1/object/sign/po-attachments/<path>?token=...`
   - Open a link in incognito → file downloads
   - Wait > 1 hr → reload PO page → link still works (re-signed on each render)
   - Try opening an old link with expired token → expect 400 (expected)

## Rollback
- Unset `PO_ATTACHMENTS_PRIVATE` (or set to anything except `"true"`)
- Make the bucket public again in Supabase

## Cleanup (optional, future)
After 30+ days of confidence in the signed flow:
- Run a one-shot backfill to populate `path` for legacy attachments stored
  in `purchase_orders.attachment_urls`. The signed-URL helper already does
  this on-the-fly via `extractAttachmentPath`, so backfill is purely
  cosmetic — useful if you want to drop the URL-parsing fallback.

```sql
-- Preview legacy attachments without path
SELECT
  po_number,
  jsonb_array_length(COALESCE(attachment_urls, '[]'::jsonb)) AS total,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(attachment_urls, '[]'::jsonb)) e
    WHERE NOT (e ? 'path')) AS legacy
FROM purchase_orders
WHERE attachment_urls IS NOT NULL AND jsonb_array_length(attachment_urls) > 0
ORDER BY created_at DESC LIMIT 20;
```

## Trade-offs
- ✅ Files no longer publicly accessible
- ✅ TTL means even leaked URLs expire in 1 hr
- ⚠️ Each PO detail render mints signed URLs (storage API call per
  attachment). Adds ~10ms per attachment in the parallel batch. Acceptable
  for typical PO with ≤ 10 files.
- ⚠️ Email-embedded links currently rely on the public URL pattern. After
  flip, those links would 404. We don't currently embed attachment URLs
  in emails — the email links to `/po/[id]` instead, so this is fine.
