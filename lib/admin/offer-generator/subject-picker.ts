export function pickSubjectVariant(
  variants: string[],
  totalSentForTemplate: number
): { index: number; subject: string } {
  if (variants.length === 0) return { index: 0, subject: 'Hey {{first_name}}' }
  const index = totalSentForTemplate % variants.length
  return { index, subject: variants[index] }
}
