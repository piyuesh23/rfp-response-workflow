"use client"

import { SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const ENGAGEMENT_PROMPTS = [
  "What are the biggest gaps in this estimate?",
  "Summarise the TOR requirements.",
  "Which integrations are missing a tier?",
  "What assumptions rely on customer Q&A?",
]

const ADMIN_PROMPTS = [
  "Which engagements are likely to close this quarter?",
  "What's the average hours per engagement type?",
  "Which accounts have the most WON deals?",
  "Summarise risks across open engagements.",
]

interface ChatEmptyStateProps {
  scope: "ENGAGEMENT" | "ADMIN"
  onPick: (question: string) => void
}

export function ChatEmptyState({ scope, onPick }: ChatEmptyStateProps) {
  const prompts = scope === "ENGAGEMENT" ? ENGAGEMENT_PROMPTS : ADMIN_PROMPTS

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <SparklesIcon className="size-5" />
      </div>
      <p className="mb-1 font-heading text-sm font-medium text-foreground">
        {scope === "ENGAGEMENT"
          ? "Ask about this engagement"
          : "Ask across admin data"}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Try one of these to get started:
      </p>
      <div className="flex w-full flex-col gap-1.5">
        {prompts.map((p) => (
          <Button
            key={p}
            variant="outline"
            size="sm"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs font-normal leading-snug"
            onClick={() => onPick(p)}
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  )
}
