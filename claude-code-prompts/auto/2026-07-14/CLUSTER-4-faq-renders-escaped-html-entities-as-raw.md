# Fix: Replace HTML entities with proper characters in FAQ component

## Context
The FAQ section component uses `&apos;` HTML entities inside JSX string content. React/JSX doesn't interpret HTML entities in string expressions — they render as literal text '&apos;' visible to users. This affects at least 5 FAQ answers and signals poor QA.

## Files to modify
- `components/landing/faq-section.tsx`

## Requirements
1. Find all instances of `&apos;` in the file and replace with the actual apostrophe character `'` (or typographic curly quote `'` if the rest of the copy uses them)
2. Also search for and fix any other HTML entities that might have the same problem: `&quot;`, `&amp;`, `&lt;`, `&gt;`, `&ndash;`, `&mdash;` etc.
3. If any strings use template literals or variables, ensure the replacement works in that context too
4. Run the command: `grep -rn '&apos;\|&quot;\|&amp;\|&ndash;\|&mdash;' components/landing/` to check if this pattern exists in other landing page components and fix those too

## Validation
- Load the homepage and scroll to the FAQ section
- Verify all apostrophes render as actual apostrophe characters, not as '&apos;' text
- Check all FAQ answers for any remaining raw HTML entities
- Run the grep command above and confirm zero results in JSX string content