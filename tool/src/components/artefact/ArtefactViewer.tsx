"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { MermaidDiagram } from "@/components/artefact/MermaidDiagram"

interface ArtefactViewerProps {
  contentMd: string
  version?: number
}

function MarkdownContent({ contentMd, className }: { contentMd: string; className?: string }) {
  return (
    <div className={cn("max-w-none text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // Tables
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-lg border border-border">
                <Table>{children}</Table>
              </div>
            )
          },
          thead({ children }) {
            return <TableHeader>{children}</TableHeader>
          },
          tbody({ children }) {
            return <TableBody>{children}</TableBody>
          },
          tr({ children }) {
            return <TableRow>{children}</TableRow>
          },
          th({ children }) {
            return (
              <TableHead className="bg-muted/50 font-semibold text-foreground">
                {children}
              </TableHead>
            )
          },
          td({ children }) {
            return <TableCell className="whitespace-normal">{children}</TableCell>
          },

          // Code blocks
          code({ className: codeClassName, children, ...props }) {
            const isBlock = codeClassName?.startsWith("language-")

            // Render Mermaid diagrams
            if (codeClassName === "language-mermaid") {
              const chart = String(children).replace(/\n$/, "")
              return <MermaidDiagram chart={chart} />
            }

            if (isBlock) {
              return (
                <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4">
                  <code
                    className={cn(
                      "font-mono text-xs leading-relaxed text-foreground",
                      codeClassName
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                </pre>
              )
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <>{children}</>
          },

          // Headings with anchors
          h1({ children }) {
            const id = String(children).toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
            return (
              <h1 id={id} className="mt-8 mb-4 scroll-mt-6 text-2xl font-bold text-foreground first:mt-0">
                <a href={`#${id}`} className="no-underline hover:underline">{children}</a>
              </h1>
            )
          },
          h2({ children }) {
            const id = String(children).toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
            return (
              <h2 id={id} className="mt-6 mb-3 scroll-mt-6 text-xl font-semibold text-foreground first:mt-0">
                <a href={`#${id}`} className="no-underline hover:underline">{children}</a>
              </h2>
            )
          },
          h3({ children }) {
            const id = String(children).toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
            return (
              <h3 id={id} className="mt-5 mb-2 scroll-mt-6 text-lg font-semibold text-foreground first:mt-0">
                <a href={`#${id}`} className="no-underline hover:underline">{children}</a>
              </h3>
            )
          },
          h4({ children }) {
            const id = String(children).toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
            return (
              <h4 id={id} className="mt-4 mb-2 scroll-mt-6 text-base font-semibold text-foreground">
                <a href={`#${id}`} className="no-underline hover:underline">{children}</a>
              </h4>
            )
          },
          h5({ children }) {
            return (
              <h5 className="mt-4 mb-1 text-sm font-semibold text-foreground">{children}</h5>
            )
          },
          h6({ children }) {
            return (
              <h6 className="mt-3 mb-1 text-sm font-medium text-muted-foreground">{children}</h6>
            )
          },

          // Links
          a({ href, children }) {
            const isExternal = href?.startsWith("http") || href?.startsWith("//")
            return (
              <a
                href={href}
                className="text-primary underline underline-offset-3 hover:text-primary/80"
                {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            )
          },

          // Paragraphs
          p({ children }) {
            return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
          },

          // Lists
          ul({ children }) {
            return <ul className="mb-4 ml-6 list-disc space-y-1 last:mb-0">{children}</ul>
          },
          ol({ children }) {
            return <ol className="mb-4 ml-6 list-decimal space-y-1 last:mb-0">{children}</ol>
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>
          },

          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-4 border-border pl-4 text-muted-foreground italic">
                {children}
              </blockquote>
            )
          },

          // Horizontal rule
          hr() {
            return <hr className="my-6 border-border" />
          },
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </div>
  )
}

export function ArtefactViewer({ contentMd, version }: ArtefactViewerProps) {
  return (
    <div className="relative rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        {version !== undefined && (
          <span className="text-xs text-muted-foreground">v{version}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Download as Markdown"
            onClick={() => {
              const blob = new Blob([contentMd], { type: "text/markdown;charset=utf-8" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `artefact${version !== undefined ? `-v${version}` : ""}.md`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <DownloadIcon className="size-4" />
            <span className="sr-only">Download</span>
          </Button>
        </div>
      </div>
      <div className="overflow-auto p-4">
        <MarkdownContent contentMd={contentMd} />
      </div>
    </div>
  )
}
