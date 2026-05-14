import type { OfferVariables } from './variable-extractor'

export function renderTemplate(template: string, vars: OfferVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (vars as unknown as Record<string, string>)[key]
    return value !== undefined && value !== '' ? value : match
  })
}

export function renderSubject(subject: string, vars: OfferVariables): string {
  return renderTemplate(subject, vars)
}

export function extractUsedVars(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map(m => m[1]))]
}
