"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, FileTextIcon, FileIcon, RocketIcon, UploadCloudIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { TechStack, EngagementType } from "@/generated/prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

interface WizardFormData {
  clientName: string
  projectName: string
  techStack: TechStack | ""
  engagementType: EngagementType | ""
}

interface UploadedFile {
  file: File
  id: string
}

// ─── Label maps ──────────────────────────────────────────────────────────────

const techStackLabels: Record<TechStack, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  WORDPRESS: "WordPress",
  WORDPRESS_NEXTJS: "WordPress + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
}

const engagementTypeLabels: Record<EngagementType, string> = {
  NEW_BUILD: "New Build",
  MIGRATION: "Migration",
  REDESIGN: "Redesign",
  ENHANCEMENT: "Enhancement",
  DISCOVERY: "Discovery",
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Details" },
  { label: "Upload TOR" },
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

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return <FileTextIcon className="size-5 text-red-500 shrink-0" />
  if (ext === "docx" || ext === "doc") return <FileTextIcon className="size-5 text-blue-500 shrink-0" />
  return <FileIcon className="size-5 text-muted-foreground shrink-0" />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Step 1: Details ─────────────────────────────────────────────────────────

interface Step1Props {
  data: WizardFormData
  onChange: (patch: Partial<WizardFormData>) => void
  onNext: () => void
  onCancel: () => void
}

function Step1Details({ data, onChange, onNext, onCancel }: Step1Props) {
  const canProceed = data.clientName.trim() !== "" && data.techStack !== "" && data.engagementType !== ""

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientName">
          Client Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clientName"
          placeholder="e.g. Acme Corporation"
          value={data.clientName}
          onChange={(e) => onChange({ clientName: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="projectName">Project Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          id="projectName"
          placeholder="e.g. Marketing Site Redesign"
          value={data.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="techStack">
          Tech Stack <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.techStack}
          onValueChange={(val) => onChange({ techStack: val as TechStack })}
        >
          <SelectTrigger id="techStack">
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
        <Label htmlFor="engagementType">
          Engagement Type <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.engagementType}
          onValueChange={(val) => onChange({ engagementType: val as EngagementType })}
        >
          <SelectTrigger id="engagementType">
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

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Upload TOR ──────────────────────────────────────────────────────

interface Step2Props {
  files: UploadedFile[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (id: string) => void
  onBack: () => void
  onNext: () => void
}

function Step2Upload({ files, onAddFiles, onRemoveFile, onBack, onNext }: Step2Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    const accepted = Array.from(incoming).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase()
      return ext === "pdf" || ext === "docx" || ext === "doc" || ext === "md"
    })
    onAddFiles(accepted)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        ].join(" ")}
      >
        <UploadCloudIcon className="size-10 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Supports PDF, DOCX, MD</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.md"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <FileTypeIcon name={uf.file.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{uf.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(uf.file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveFile(uf.id)}
                aria-label={`Remove ${uf.file.name}`}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────

interface Step3Props {
  data: WizardFormData
  files: UploadedFile[]
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function Step3Confirm({ data, files, onBack, onSubmit, isSubmitting }: Step3Props) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Engagement Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Client Name</span>
            <span className="font-medium">{data.clientName}</span>

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
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Uploaded Files ({files.length})</p>
            {files.map((uf) => (
              <div key={uf.id} className="flex items-center gap-2 text-sm">
                <FileTypeIcon name={uf.file.name} />
                <span className="truncate">{uf.file.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {formatBytes(uf.file.size)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {files.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No TOR files uploaded — you can add them later.</p>
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

  const [formData, setFormData] = React.useState<WizardFormData>({
    clientName: "",
    projectName: "",
    techStack: "",
    engagementType: "",
  })

  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])

  function patchForm(patch: Partial<WizardFormData>) {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  function addFiles(incoming: File[]) {
    const next: UploadedFile[] = incoming.map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }))
    setUploadedFiles((prev) => [...prev, ...next])
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      // 1. Create the engagement via API
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.clientName,
          projectName: formData.projectName || undefined,
          techStack: formData.techStack,
          engagementType: formData.engagementType || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create engagement")
      }

      const engagement = await res.json()
      const engagementId = engagement.id

      // 2. Upload TOR files if any
      if (uploadedFiles.length > 0) {
        const fd = new FormData()
        fd.append("engagementId", engagementId)
        for (const uf of uploadedFiles) {
          fd.append("file", uf.file)
        }
        await fetch("/api/upload", { method: "POST", body: fd })
      }

      // 3. Redirect to the new engagement
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
        <Step1Details
          data={formData}
          onChange={patchForm}
          onNext={() => setStep(2)}
          onCancel={() => router.back()}
        />
      )}

      {step === 2 && (
        <Step2Upload
          files={uploadedFiles}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3Confirm
          data={formData}
          files={uploadedFiles}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
