# Lab Notes — upload


---

## Cycle #1 — 2026-07-02

Replace the current proxy-through-API upload architecture with direct-to-Supabase TUS resumable uploads. The root cause of abandonment is not just a fake progress bar — it's that large files (100-500MB gameplay recordings) silently die mid-flight because Netlify serverless functions have a 60s max duration and a hard body size limit well below the advertised 500MB cap. Fix the architecture first: (1) a lightweight API route generates a signed upload URL/token, (2) the browser uploads directly to

**Confidence**: 8/10 | **Effort**: 4h
**Kill switch**: Supabase Storage has its own TUS upload size limits, rate limits, or RLS policy constraints that block direct browser uploads to the `videos/` bucket — meaning direct uploads fail for unauthenticated or improperly scoped requests. Severity is high if the current proxy architecture was put in place specifically because direct uploads were attempted and failed (e.g. CORS issues, bucket policy blocks public uploads, or the Supabase project plan has Storage bandwidth caps that make direct large-file uploads expensive). A secondary kill switch: if the Netlify body limit was intentionally set low as a content-scanning gate (malware, copyright), bypassing it with direct uploads creates a security/compliance gap.
[Full deep dive](../cycles/2026-07-02-cycle1/upload.md)
