"use client"

import * as React from "react"
import DOMPurify from "dompurify"

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [svg, setSvg] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          fontFamily: "inherit",
        })

        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg: rendered } = await mermaid.render(id, chart.trim())
        if (!cancelled) {
          // Sanitize SVG output for safety
          const clean = DOMPurify.sanitize(rendered, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["foreignObject"],
          })
          setSvg(clean)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
          setSvg("")
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (error) {
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-muted-foreground">
        {chart}
      </pre>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-xs text-muted-foreground">
        Rendering diagram...
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 overflow-x-auto rounded-lg border border-border bg-background p-4 [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
