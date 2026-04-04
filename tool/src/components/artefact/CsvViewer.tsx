"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface CsvViewerProps {
  content: string
  maxRows?: number
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        cells.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
  }
  cells.push(current.trim())
  return cells
}

export function CsvViewer({ content, maxRows = 500 }: CsvViewerProps) {
  const lines = content.split("\n").filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4">Empty CSV file.</p>
    )
  }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1, maxRows + 1).map(parseCsvLine)
  const truncated = lines.length - 1 > maxRows

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, i) => (
                <TableHead
                  key={i}
                  className="bg-muted/50 font-semibold text-foreground whitespace-nowrap"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {headers.map((_, colIdx) => (
                  <TableCell key={colIdx} className="whitespace-nowrap">
                    {row[colIdx] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {rows.length} row{rows.length !== 1 ? "s" : ""}, {headers.length} column{headers.length !== 1 ? "s" : ""}
        </span>
        {truncated && (
          <span className="text-amber-600">
            Showing first {maxRows} of {lines.length - 1} rows
          </span>
        )}
      </div>
    </div>
  )
}
