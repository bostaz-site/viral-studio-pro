'use client'

import { MAPPABLE_FIELDS } from '@/lib/admin/csv-parser'

interface ColumnMapperProps {
  csvHeaders: string[]
  mapping: Record<string, string>
  onMappingChange: (mapping: Record<string, string>) => void
  previewRows: Record<string, string>[]
}

export function ColumnMapper({ csvHeaders, mapping, onMappingChange, previewRows }: ColumnMapperProps) {
  const usedFields = new Set(Object.values(mapping).filter(v => v && v !== '__skip__'))
  const emailMapped = usedFields.has('email')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Map CSV Columns</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Match your CSV headers to the correct fields.{' '}
            {!emailMapped && <span className="text-destructive font-medium">Email is required.</span>}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">CSV Column</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Sample Data</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Maps To</th>
            </tr>
          </thead>
          <tbody>
            {csvHeaders.map((header, i) => {
              const currentValue = mapping[header] ?? '__skip__'
              const sampleValues = previewRows
                .slice(0, 3)
                .map(r => r[header])
                .filter(Boolean)
                .join(', ')

              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{header}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                    {sampleValues || '(empty)'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={currentValue}
                      onChange={e => {
                        onMappingChange({ ...mapping, [header]: e.target.value })
                      }}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="__skip__">-- Skip --</option>
                      {MAPPABLE_FIELDS.map(field => {
                        const isUsed = usedFields.has(field.key) && currentValue !== field.key
                        return (
                          <option key={field.key} value={field.key} disabled={isUsed}>
                            {field.label}{field.required ? ' *' : ''}{isUsed ? ' (used)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
