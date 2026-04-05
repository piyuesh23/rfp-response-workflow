import * as React from "react"
import { CreateWizard } from "@/components/engagement/CreateWizard"

export const metadata = {
  title: "Create New Engagement | RFP Copilot",
}

export default function NewEngagementPage() {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Create New Engagement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a new pre-sales engagement and upload your TOR document.
          </p>
        </div>
        <CreateWizard />
      </div>
    </div>
  )
}
