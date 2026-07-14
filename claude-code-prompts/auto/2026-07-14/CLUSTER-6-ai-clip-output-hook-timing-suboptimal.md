# Fix: Improve AI clip trim to front-load emotional peak moments

## Context
The AI-selected clip start points are choosing pre-reaction buildup rather than the peak emotional moment. In the audited example, the explosive reaction doesn't appear until ~6 seconds in, wasting the critical hook window. The clip trimming logic needs to prioritize high-energy frames for the opening.

## Files to modify
- The clip/moment detection algorithm (likely a backend service — search for clip trimming, moment detection, highlight detection logic)
- If there's a scoring/ranking model for clip segments, that's the primary target
- The clip trim UI if it allows manual adjustment (to add a 'hook preview' indicator)

## Requirements
1. **Investigate the current clip selection logic**: Find the algorithm that determines clip in/out points. Document how it currently scores moments (audio peaks? chat activity? motion detection?).
2. **Add or boost 'emotional peak' signal weighting**:
   - If using audio analysis: the loudest/most energetic moment should be at or near the clip start, not buried mid-clip
   - If using visual analysis: rapid motion changes, facial expression peaks, or text overlay appearances (like 'GOAL!') should boost start-point scoring
   - If using chat/engagement signals: the peak chat moment should align with the first 2 seconds
3. **Consider a cold-open strategy**: For clips where the peak is naturally mid-sequence, implement a 0.5-1s flash-forward: show the peak frame first, then cut to the buildup. This is a common TikTok editing pattern.
4. **Add a hook quality score** to clip metadata: rate how strong the first 2 seconds are on a simple scale. Surface this in the UI so users can prioritize clips with strong hooks.
5. **If manual trim UI exists**: Add a visual indicator showing where the detected 'peak moment' is on the timeline, so users can quickly snap the start point there.

## Validation
- Process the same source clip and compare: does the new output start closer to the emotional peak?
- Review 5-10 sample outputs to check if hook timing has generally improved
- Ensure the change doesn't break clips where the buildup IS the hook (e.g., suspenseful moments)
- Check that the flash-forward technique (if implemented) doesn't create jarring cuts