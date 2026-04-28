"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, FileTextIcon, RocketIcon, UploadCloudIcon, XIcon, Loader2, SparklesIcon, AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { TechStack, EngagementType, Industry } from "@/generated/prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountOption {
  id: string
  canonicalName: string
  industry: string
}

type EstimationMode = "BIG_BANG" | "PHASED" | "UNDECIDED"

interface WizardFormData {
  accountId: string
  accountName: string
  isNewAccount: boolean
  industry: Industry | ""
  projectName: string
  techStack: TechStack | ""
  techStackCustom: string
  engagementType: EngagementType | ""
  projectDescription: string
  legacyPlatform: string
  legacyPlatformUrl: string
  estimationMode: EstimationMode
}

interface InferenceResult {
  clientName: string | null
  projectName: string | null
  techStack: string | null
  engagementType: string | null
  industry: string | null
  projectDescription: string | null
  legacyPlatform: string | null
  confidence: {
    clientName: number
    projectName: number
    techStack: number
    engagementType: number
    industry: number
  }
}

// ─── Label maps ──────────────────────────────────────────────────────────────

import { techStackLabels, engagementTypeLabels, industryLabels } from "@/lib/engagement-labels";

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Upload TOR" },
  { label: "Details" },
  { label: "Estimation" },
  { label: "Confirm" },
]

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, index) => {
        const stepNum = index + 1
        const isCompleted = currentStep > stepNum
        const isActive = currentStep === stepNum

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                    ? "border-primary bg-background text-primary"
                    : "border-muted-foreground/30 bg-background text-muted-foreground",
                ].join(" ")}
              >
                {isCompleted ? <CheckIcon className="size-4" /> : stepNum}
              </div>
              <span
                className={[
                  "text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={[
                  "h-0.5 flex-1 mx-2 mb-5 transition-colors",
                  currentStep > stepNum ? "bg-primary" : "bg-muted-foreground/20",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── File icon helper ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Step 1: Upload TOR (mandatory, PDF only) ───────────────────────────────

interface Step1Props {
  file: File | null
  onFileSelected: (file: File) => void
  onRemoveFile: () => void
  onNext: () => void
  onCancel: () => void
  isAnalyzing: boolean
  analyzeError: string | null
}

function Step1Upload({ file, onFileSelected, onRemoveFile, onNext, onCancel, isAnalyzing, analyzeError }: Step1Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  function handleFile(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return
    const f = incoming[0]
    const ext = f.name.split(".").pop()?.toLowerCase()
    if (ext !== "pdf") return
    onFileSelected(f)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Upload the TOR / RFP / SOW document. We'll analyze it to pre-fill engagement details.
        </p>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          className={[
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          ].join(" ")}
        >
          <UploadCloudIcon className="size-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drop your TOR here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF files only (max 30MB)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>
      )}

      {/* Selected file */}
      {file && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <FileTextIcon className="size-5 text-red-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Analyzing...
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemoveFile}
              aria-label="Remove file"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      )}

      {analyzeError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>{analyzeError} You can still fill in details manually.</span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onNext} disabled={!file || isAnalyzing}>
          {isAnalyzing ? "Analyzing..." : "Next"}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Details (AI-pre-filled, editable) ─────────────────────────────

interface Step2Props {
  data: WizardFormData
  onChange: (patch: Partial<WizardFormData>) => void
  confidence: InferenceResult["confidence"] | null
  accounts: AccountOption[]
  onBack: () => void
  onNext: () => void
}

function Step2Details({ data, onChange, confidence, accounts, onBack, onNext }: Step2Props) {
  const [accountSearch, setAccountSearch] = React.useState(data.accountName)
  const [showNewAccount, setShowNewAccount] = React.useState(data.isNewAccount)

  const needsLegacyBlock = data.engagementType === "MIGRATION" || data.engagementType === "REDESIGN"
  const needsStackDescription = data.techStack === "OTHER"

  const canProceed =
    (data.accountId !== "" || (showNewAccount && data.accountName.trim() !== "")) &&
    data.techStack !== "" &&
    data.engagementType !== "" &&
    (!needsStackDescription || data.techStackCustom.trim().length >= 10)

  const isLowConfidence = (field: keyof NonNullable<typeof confidence>) =>
    confidence && confidence[field] > 0 && confidence[field] < 0.7

  const aiHint = (field: keyof NonNullable<typeof confidence>) => {
    if (!confidence || confidence[field] === 0) return null
    if (confidence[field] < 0.7) {
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <SparklesIcon className="size-3" /> AI-inferred — please verify
        </span>
      )
    }
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <SparklesIcon className="size-3" /> AI-inferred
      </span>
    )
  }

  // Filter accounts by search
  const filtered = accounts.filter((a) =>
    a.canonicalName.toLowerCase().includes(accountSearch.toLowerCase())
  )

  function handleSelectAccount(accountId: string | null) {
    if (!accountId) return
    const account = accounts.find((a) => a.id === accountId)
    if (account) {
      onChange({ accountId, accountName: account.canonicalName, isNewAccount: false, industry: (account.industry as Industry) || "" })
      setAccountSearch(account.canonicalName)
      setShowNewAccount(false)
    }
  }

  function handleNewAccount() {
    onChange({ accountId: "", accountName: accountSearch, isNewAccount: true })
    setShowNewAccount(true)
  }

  return (
    <div className="flex flex-col gap-5">
      {confidence && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <SparklesIcon className="size-4 shrink-0" />
          <span>Fields pre-filled from your TOR document. Review and adjust as needed.</span>
        </div>
      )}

      {/* Account selection */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="account">
            Account / Client <span className="text-destructive">*</span>
          </Label>
          {aiHint("clientName")}
        </div>
        {!showNewAccount ? (
          <div className="flex flex-col gap-2">
            <Select
              value={data.accountId}
              onValueChange={handleSelectAccount}
            >
              <SelectTrigger
                id="account"
                className={isLowConfidence("clientName") ? "border-amber-400 dark:border-amber-600" : ""}
              >
                <SelectValue placeholder="Select an existing account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.canonicalName}
                    {a.industry && a.industry !== "OTHER" && (
                      <span className="text-muted-foreground"> — {industryLabels[a.industry as Industry] ?? a.industry}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={handleNewAccount}
              className="text-xs text-primary hover:underline text-left"
            >
              + Create new account
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">New Account</span>
              <button
                type="button"
                onClick={() => { setShowNewAccount(false); onChange({ isNewAccount: false, accountId: "", accountName: "" }) }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <Input
              placeholder="Account name (e.g. Acme Corporation)"
              value={data.accountName}
              onChange={(e) => { onChange({ accountName: e.target.value }); setAccountSearch(e.target.value) }}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="industry" className="text-xs">
                Industry <span className="text-destructive">*</span>
              </Label>
              {aiHint("industry")}
              <Select
                value={data.industry}
                onValueChange={(val) => onChange({ industry: val as Industry })}
              >
                <SelectTrigger id="industry" className={isLowConfidence("industry") ? "border-amber-400 dark:border-amber-600" : ""}>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(industryLabels) as Industry[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {industryLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="projectName">Project Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
          {aiHint("projectName")}
        </div>
        <Input
          id="projectName"
          placeholder="e.g. Marketing Site Redesign"
          value={data.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
          className={isLowConfidence("projectName") ? "border-amber-400 dark:border-amber-600" : ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="techStack">
            Tech Stack <span className="text-destructive">*</span>
          </Label>
          {aiHint("techStack")}
        </div>
        <Select
          value={data.techStack}
          onValueChange={(val) => onChange({ techStack: val as TechStack })}
        >
          <SelectTrigger
            id="techStack"
            className={isLowConfidence("techStack") ? "border-amber-400 dark:border-amber-600" : ""}
          >
            <SelectValue placeholder="Select a tech stack" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(techStackLabels) as TechStack[]).map((key) => (
              <SelectItem key={key} value={key}>
                {techStackLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="engagementType">
            Engagement Type <span className="text-destructive">*</span>
          </Label>
          {aiHint("engagementType")}
        </div>
        <Select
          value={data.engagementType}
          onValueChange={(val) => onChange({ engagementType: val as EngagementType })}
        >
          <SelectTrigger
            id="engagementType"
            className={isLowConfidence("engagementType") ? "border-amber-400 dark:border-amber-600" : ""}
          >
            <SelectValue placeholder="Select engagement type" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(engagementTypeLabels) as EngagementType[]).map((key) => (
              <SelectItem key={key} value={key}>
                {engagementTypeLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Free-text tech stack description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="techStackCustom">
          Tech Stack Details {needsStackDescription && <span className="text-destructive">*</span>}
          {!needsStackDescription && <span className="text-muted-foreground text-xs"> (optional — augments the canonical stack)</span>}
        </Label>
        <Textarea
          id="techStackCustom"
          placeholder="e.g. Laravel 10 + Vue 3 + MySQL on AWS. One or two sentences covering language, framework, DB, hosting."
          value={data.techStackCustom}
          onChange={(e) => onChange({ techStackCustom: e.target.value })}
          rows={2}
        />
        {needsStackDescription && data.techStackCustom.trim().length > 0 && data.techStackCustom.trim().length < 10 && (
          <span className="text-xs text-amber-600">Please describe the stack in a little more detail (≥10 chars).</span>
        )}
      </div>

      {/* Project description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="projectDescription">
          Project Description <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="projectDescription"
          placeholder="What is this project about? What is the customer trying to achieve? (1–3 paragraphs)"
          value={data.projectDescription}
          onChange={(e) => onChange({ projectDescription: e.target.value })}
          rows={4}
        />
      </div>

      {/* Legacy platform block — MIGRATION/REDESIGN only */}
      {needsLegacyBlock && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Current Platform {data.engagementType === "MIGRATION" ? "(source of migration)" : "(site being redesigned)"}
          </span>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legacyPlatform" className="text-xs">Current Platform</Label>
            <Textarea
              id="legacyPlatform"
              placeholder="e.g. Sitecore 9.2 on IIS with MSSQL; custom PHP 7 monolith; WordPress 5.8 multisite"
              value={data.legacyPlatform}
              onChange={(e) => onChange({ legacyPlatform: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legacyPlatformUrl" className="text-xs">Current Site URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="legacyPlatformUrl"
              placeholder="https://www.example.com"
              value={data.legacyPlatformUrl}
              onChange={(e) => onChange({ legacyPlatformUrl: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Estimation Approach ─────────────────────────────────────────────

interface Step3EstimationProps {
  mode: EstimationMode
  onChange: (mode: EstimationMode) => void
  onBack: () => void
  onNext: () => void
}

function Step3EstimationMode({ mode, onChange, onBack, onNext }: Step3EstimationProps) {
  const options: Array<{ value: EstimationMode; title: string; description: string; icon: string }> = [
    {
      value: "BIG_BANG",
      title: "Big Bang",
      description: "Single comprehensive estimate covering the full engagement. Best for smaller projects or when scope is well-defined.",
      icon: "B",
    },
    {
      value: "PHASED",
      title: "Phased",
      description: "AI breaks the TOR into logical delivery phases. Each phase gets its own estimate and Excel workbook. Best for larger or staged engagements.",
      icon: "P",
    },
    {
      value: "UNDECIDED",
      title: "Decide Later",
      description: "Skip for now. You can choose after Phase 1 TOR analysis when scope is clearer.",
      icon: "?",
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        How should estimates be structured for this engagement?
      </p>

      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
              mode === opt.value
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/20",
            ].join(" ")}
          >
            <div className={[
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              mode === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            ].join(" ")}>
              {opt.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{opt.title}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}

// ─── Step 4: Confirm ─────────────────────────────────────────────────────────

interface Step3Props {
  data: WizardFormData
  file: File | null
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function Step3Confirm({ data, file, onBack, onSubmit, isSubmitting }: Step3Props) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Engagement Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium">{data.accountName}{data.isNewAccount && <Badge variant="outline" className="ml-2 text-xs">New</Badge>}</span>

            {data.industry && (
              <>
                <span className="text-muted-foreground">Industry</span>
                <span><Badge variant="secondary">{industryLabels[data.industry as Industry]}</Badge></span>
              </>
            )}

            <span className="text-muted-foreground">Project Name</span>
            <span className="font-medium">{data.projectName || <span className="text-muted-foreground italic">—</span>}</span>

            <span className="text-muted-foreground">Tech Stack</span>
            <span>
              {data.techStack && (
                <Badge variant="secondary">{techStackLabels[data.techStack as TechStack]}</Badge>
              )}
            </span>

            <span className="text-muted-foreground">Engagement Type</span>
            <span>
              {data.engagementType && (
                <Badge variant="outline">{engagementTypeLabels[data.engagementType as EngagementType]}</Badge>
              )}
            </span>

            {data.techStackCustom.trim() && (
              <>
                <span className="text-muted-foreground">Stack Details</span>
                <span className="font-medium whitespace-pre-wrap">{data.techStackCustom}</span>
              </>
            )}

            {data.projectDescription.trim() && (
              <>
                <span className="text-muted-foreground">Project Description</span>
                <span className="whitespace-pre-wrap">{data.projectDescription}</span>
              </>
            )}

            {(data.engagementType === "MIGRATION" || data.engagementType === "REDESIGN") && data.legacyPlatform.trim() && (
              <>
                <span className="text-muted-foreground">Current Platform</span>
                <span className="whitespace-pre-wrap">{data.legacyPlatform}</span>
              </>
            )}

            {(data.engagementType === "MIGRATION" || data.engagementType === "REDESIGN") && data.legacyPlatformUrl.trim() && (
              <>
                <span className="text-muted-foreground">Current Site URL</span>
                <span className="truncate"><a href={data.legacyPlatformUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{data.legacyPlatformUrl}</a></span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {file && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">TOR Document</p>
            <div className="flex items-center gap-2 text-sm">
              <FileTextIcon className="size-5 text-red-500 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          <RocketIcon className="size-4" />
          {isSubmitting ? "Creating…" : "Create & Start Analysis"}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function CreateWizard() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // TOR file state
  const [torFile, setTorFile] = React.useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null)
  const [inferenceResult, setInferenceResult] = React.useState<InferenceResult | null>(null)

  // Accounts list
  const [accounts, setAccounts] = React.useState<AccountOption[]>([])
  React.useEffect(() => {
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAccounts(Array.isArray(data) ? data.map((a: { id: string; canonicalName: string; industry: string }) => ({ id: a.id, canonicalName: a.canonicalName, industry: a.industry })) : []))
      .catch(() => {})
  }, [])

  const [formData, setFormData] = React.useState<WizardFormData>({
    accountId: "",
    accountName: "",
    isNewAccount: false,
    industry: "",
    projectName: "",
    techStack: "",
    techStackCustom: "",
    engagementType: "",
    projectDescription: "",
    legacyPlatform: "",
    legacyPlatformUrl: "",
    estimationMode: "BIG_BANG",
  })

  function patchForm(patch: Partial<WizardFormData>) {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  async function handleFileSelected(file: File) {
    setTorFile(file)
    setAnalyzeError(null)
    setIsAnalyzing(true)

    try {
      // Step 1: Extract text from PDF server-side
      const extractForm = new FormData()
      extractForm.append("file", file)
      const extractRes = await fetch("/api/extract-text", {
        method: "POST",
        body: extractForm,
      })

      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}))
        throw new Error(err.error || `PDF extraction failed (${extractRes.status})`)
      }

      const { text } = await extractRes.json()

      if (!text || text.trim().length < 50) {
        setAnalyzeError("Could not extract enough text from PDF.")
        setIsAnalyzing(false)
        return
      }

      // Step 2: Infer engagement fields from extracted text
      const inferRes = await fetch("/api/engagements/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torText: text }),
      })

      if (!inferRes.ok) {
        const err = await inferRes.json().catch(() => ({}))
        throw new Error(err.error || `AI inference failed (${inferRes.status})`)
      }

      const result: InferenceResult = await inferRes.json()
      setInferenceResult(result)

      // Try to match inferred client name to existing account
      const inferredName = result.clientName ?? ""
      const matchedAccount = accounts.find((a) =>
        a.canonicalName.toLowerCase() === inferredName.toLowerCase()
      )

      // Pre-fill form with inferred values
      setFormData({
        accountId: matchedAccount?.id ?? "",
        accountName: inferredName,
        isNewAccount: !matchedAccount && inferredName !== "",
        industry: ((matchedAccount?.industry as Industry) || (result.industry as Industry)) ?? "",
        projectName: result.projectName ?? "",
        techStack: (result.techStack as TechStack) ?? "",
        techStackCustom: "",
        engagementType: (result.engagementType as EngagementType) ?? "",
        projectDescription: result.projectDescription ?? "",
        legacyPlatform: result.legacyPlatform ?? "",
        legacyPlatformUrl: "",
        estimationMode: "BIG_BANG",
      })
    } catch (err) {
      console.error("[CreateWizard] Analysis failed:", err)
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleRemoveFile() {
    setTorFile(null)
    setInferenceResult(null)
    setAnalyzeError(null)
    setFormData({ accountId: "", accountName: "", isNewAccount: false, industry: "", projectName: "", techStack: "", techStackCustom: "", engagementType: "", projectDescription: "", legacyPlatform: "", legacyPlatformUrl: "", estimationMode: "BIG_BANG" })
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      // 1. Create account if new
      let accountId = formData.accountId
      if (formData.isNewAccount && formData.accountName.trim()) {
        const acctRes = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canonicalName: formData.accountName.trim(),
            industry: formData.industry || undefined,
          }),
        })
        if (acctRes.ok) {
          const acct = await acctRes.json()
          accountId = acct.id
        }
      }

      // 2. Create the engagement
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.accountName,
          projectName: formData.projectName || undefined,
          techStack: formData.techStack,
          techStackCustom: formData.techStackCustom.trim() || undefined,
          techStackIsCustom: formData.techStack === "OTHER",
          engagementType: formData.engagementType || undefined,
          projectDescription: formData.projectDescription.trim() || undefined,
          legacyPlatform: formData.legacyPlatform.trim() || undefined,
          legacyPlatformUrl: formData.legacyPlatformUrl.trim() || undefined,
          accountId: accountId || undefined,
          estimationMode: formData.estimationMode,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create engagement")
      }

      const engagement = await res.json()
      const engagementId = engagement.id

      // 3. Upload TOR file
      if (torFile) {
        const fd = new FormData()
        fd.append("engagementId", engagementId)
        fd.append("file", torFile)
        await fetch("/api/upload", { method: "POST", body: fd })
      }

      // 3. Redirect to engagement
      router.push(`/engagements/${engagementId}`)
    } catch (err) {
      console.error("Failed to create engagement:", err)
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <Step1Upload
          file={torFile}
          onFileSelected={handleFileSelected}
          onRemoveFile={handleRemoveFile}
          onNext={() => setStep(2)}
          onCancel={() => router.back()}
          isAnalyzing={isAnalyzing}
          analyzeError={analyzeError}
        />
      )}

      {step === 2 && (
        <Step2Details
          data={formData}
          onChange={patchForm}
          confidence={inferenceResult?.confidence ?? null}
          accounts={accounts}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3EstimationMode
          mode={formData.estimationMode}
          onChange={(m) => patchForm({ estimationMode: m })}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step3Confirm
          data={formData}
          file={torFile}
          onBack={() => setStep(3)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
