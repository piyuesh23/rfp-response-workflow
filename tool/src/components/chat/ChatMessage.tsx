"use client"

import { cn } from "@/lib/utils"
import { ChatSourcesList, type CitedSource } from "./ChatSourcesList"

export interface ChatMessageData {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: CitedSource[]
}

interface ChatMessageProps {
  message: ChatMessageData
  engagementId?: string
}

export function ChatMessage({ message, engagementId }: ChatMessageProps) {
  const isUser = message.role === "user"
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug whitespace-pre-wrap",
          isUser
            ? "bg-muted text-foreground"
            : "border border-border bg-background text-foreground"
        )}
      >
        {message.content}
      </div>
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="max-w-[95%]">
          <ChatSourcesList
            sources={message.sources}
            engagementId={engagementId}
          />
        </div>
      )}
    </div>
  )
}
