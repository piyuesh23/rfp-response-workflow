"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  HelpCircleIcon,
  Loader2Icon,
  MessageCircleIcon,
  SendIcon,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { ChatMessage, type ChatMessageData } from "./ChatMessage"
import { ChatEmptyState } from "./ChatEmptyState"
import type { CitedSource } from "./ChatSourcesList"

type ChatScope = "ENGAGEMENT" | "ADMIN"

interface DerivedScope {
  scope: ChatScope
  engagementId?: string
}

const MAX_HISTORY_TURNS = 10

function deriveScope(pathname: string | null): DerivedScope | null {
  if (!pathname) return null
  const m = pathname.match(/^\/engagements\/([^/]+)(\/.*)?$/)
  if (m && m[1] !== "new") {
    return { scope: "ENGAGEMENT", engagementId: m[1] }
  }
  if (pathname.startsWith("/admin")) {
    return { scope: "ADMIN" }
  }
  return null
}

function humaniseError(status: number | null, fallback: string): string {
  if (status === 429) {
    return "You've hit the chat rate limit (60 questions/hour). Try again shortly."
  }
  if (status === 403) {
    return "You don't have access to chat in this scope."
  }
  if (status === 400) {
    return "That question couldn't be processed. Try rephrasing."
  }
  if (status && status >= 500) {
    return "The assistant is temporarily unavailable. Please retry."
  }
  return fallback
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ChatDrawer() {
  const pathname = usePathname()
  const derived = React.useMemo(() => deriveScope(pathname), [pathname])
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessageData[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Reset state on scope change (e.g. user navigates to different engagement).
  const scopeKey =
    derived?.scope === "ENGAGEMENT"
      ? `ENG:${derived.engagementId}`
      : derived?.scope === "ADMIN"
        ? "ADMIN"
        : "NONE"
  React.useEffect(() => {
    setMessages([])
    setError(null)
    setInput("")
  }, [scopeKey])

  // Auto-scroll to bottom on new messages.
  React.useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  // Focus textarea when drawer opens.
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!derived) return null

  const title =
    derived.scope === "ENGAGEMENT"
      ? "Chat with this engagement"
      : "Admin assistant"
  const subtitle =
    derived.scope === "ENGAGEMENT"
      ? "I only know about this engagement's data."
      : "I can search across all admin-accessible data."
  const tooltipText =
    derived.scope === "ENGAGEMENT"
      ? "Answers are restricted to TOR, requirements, line items, assumptions, risks and artefacts for this engagement only."
      : "Answers draw from all engagements, accounts, benchmarks, and imports that your admin role can access."

  const sendQuestion = async (raw: string) => {
    const question = raw.trim()
    if (!question || sending) return

    setError(null)
    const userMsg: ChatMessageData = {
      id: makeId(),
      role: "user",
      content: question,
    }

    // Build history BEFORE adding the new user message (server gets prior turns).
    const history = messages
      .slice(-MAX_HISTORY_TURNS * 2)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: derived.scope,
          engagementId: derived.engagementId,
          question,
          history,
        }),
      })

      if (!res.ok) {
        setError(humaniseError(res.status, "Chat request failed."))
        setSending(false)
        return
      }

      const data: { answer: string; citedSources?: CitedSource[] } =
        await res.json()

      const assistantMsg: ChatMessageData = {
        id: makeId(),
        role: "assistant",
        content: data.answer,
        sources: data.citedSources ?? [],
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setError(humaniseError(null, "Network error. Please retry."))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendQuestion(input)
    }
  }

  return (
    <>
      {!open && (
        <Button
          aria-label="Open chat assistant"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 size-12 rounded-full shadow-lg"
          size="icon-lg"
        >
          <MessageCircleIcon className="size-5" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[400px]"
          aria-label={title}
        >
          <SheetHeader className="border-b p-4 pr-12">
            <div className="flex items-start gap-1.5">
              <SheetTitle>{title}</SheetTitle>
              <Tooltip>
                <TooltipTrigger>
                  <span
                    aria-label="About chat scope"
                    className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircleIcon className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            </div>
            <SheetDescription>{subtitle}</SheetDescription>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 ? (
              <ChatEmptyState
                scope={derived.scope}
                onPick={(q) => {
                  setInput(q)
                  void sendQuestion(q)
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    engagementId={derived.engagementId}
                  />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" />
                    Thinking...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t p-3">
            {error && (
              <div
                role="alert"
                className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
              >
                {error}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  derived.scope === "ENGAGEMENT"
                    ? "Ask about this engagement..."
                    : "Ask about admin data..."
                }
                rows={2}
                maxLength={500}
                disabled={sending}
                className="min-h-[44px] flex-1 resize-none text-sm"
                aria-label="Chat question"
              />
              <Button
                type="button"
                size="icon"
                aria-label="Send question"
                disabled={sending || !input.trim()}
                onClick={() => void sendQuestion(input)}
              >
                {sending ? (
                  <Loader2Icon
                    className={cn("size-4 animate-spin")}
                  />
                ) : (
                  <SendIcon className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
