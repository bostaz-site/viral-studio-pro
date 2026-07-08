# Fix: Remove duplicate file format info on upload page

## Context
The upload page (`app/upload/page.tsx` or `components/upload/`) renders the accepted formats line ('MP4, MOV, MKV, AVI, WebM — max 2 GB') in two places: inside the drag-and-drop zone AND in a footer/helper text below the URL import section. Three findings flag this as redundant clutter.

## Requirements
1. Find all instances of the file format string on the upload page. Search the codebase for 'MP4' or 'MKV' or 'max 2 GB' to locate both.
2. Keep the format info ONLY inside the drop zone component where it's contextually relevant.
3. Remove the duplicate footer/helper text instance.
4. In place of the removed line, add a subtle plan status hint for free-tier users: 'Free plan · X/3 clips remaining this month · [Upgrade for unlimited](/pricing)'. If the user's clip count is available from context/session, wire it in; if not, add a TODO.

## Files likely involved
- `app/upload/page.tsx`
- `components/upload/dropzone.tsx` or similar
- `components/upload/url-import.tsx` or similar

## Acceptance criteria
- The format string appears exactly once on `/upload`.
- A plan status hint is rendered where the duplicate used to be (even if placeholder data).