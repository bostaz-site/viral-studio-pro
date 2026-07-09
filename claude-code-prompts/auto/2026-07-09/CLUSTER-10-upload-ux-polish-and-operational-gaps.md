# Fix: Upload UX Polish, Output Quality, and Misc Operational Gaps

## Context
This cluster groups lower-severity findings that share a common theme of 'lack of polish' across several surfaces: duplicated file format text on /upload (118, 120, 122), missing upload phase labels (140), pricing anchor scroll bug (108), output quality issues (134, 135, 136), a cold email workflow gap (125), and an npm vulnerability (126). These are individually minor but collectively erode trust.

## Task

### 1. Remove duplicate file format info on /upload
- File: the upload page component.
- The accepted formats line (`MP4, MOV, MKV, AVI, WebM — max 2 GB`) appears both inside the drop zone AND in a footer line below.
- Remove the footer duplicate. Keep the format info only inside the drop zone.
- In the freed-up footer space, add a one-line plan status hint for free users: `Free plan · X/3 clips used this month — Upgrade for more`.

### 2. Add upload phase labels to the progress bar
- Find the upload progress component (referenced as `upload/client:15-17`).
- Add a `uploadPhase` state with values: `'preparing' | 'uploading' | 'confirming' | 'done'`.
- Render a label above/beside the progress bar that updates:
  - `Preparing upload…` (during S3 presign / URL generation)
  - `Uploading (42%)…` (during byte transfer, with percentage)
  - `Finalizing…` (during server confirmation/processing)
  - `Done! ✓` (on completion)
- This alone significantly reduces perceived wait time and support tickets.

### 3. Fix pricing section scroll anchor
- The 'Pricing' nav link scrolls to a position that shows an FAQ accordion item instead of the pricing heading.
- Find the anchor target for the pricing nav link and adjust it so `Pick Your Plan, Start Clipping` (or the pricing section heading) is the first element visible in the viewport when clicked.
- Add a `scroll-margin-top` of at least `80px` (or your sticky nav height) to the pricing section's anchor element.

### 4. Fix npm vulnerability
- Run `npm install eslint-config-next@latest` (or `@16.2.10+`).
- Run `npm audit` to verify the glob ReDoS vulnerability is resolved.
- Pin the version in `package.json`.

### 5. (Documentation only) Cold email reply workflow
- Create a document (Notion/README) defining:
  - Promo code naming convention: `CREATOR_[NAME]_20`
  - Reply SLA: < 4 hours for positive replies
  - Tracking fields: Creator Handle | Reply Date | Promo Code Sent | Trial Started | Converted
  - Owner assignment for daily reply monitoring
- This is a process/documentation task, not a code change.

### 6. (Backlog) Output quality improvements
- These are render pipeline improvements that require deeper investigation:
  - Crop/mask stream UI overlays (chat, HUD) during frame processing
  - Apply audio normalization (noise gate, EQ boost 2-5kHz, -14 LUFS)
  - Improve hook timing — start clips at the emotional peak, not the buildup
- Log these as separate backlog tickets with the render pipeline team.

## Acceptance Criteria
- File format info appears only once on /upload.
- Upload progress bar shows phase labels that update through the upload lifecycle.
- Clicking 'Pricing' in nav scrolls to the pricing heading, not the FAQ.
- `npm audit` shows no high-severity vulnerabilities.
- Cold email reply workflow is documented.