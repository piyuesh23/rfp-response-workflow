-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Industry" AS ENUM ('HEALTHCARE', 'FINTECH', 'EDUCATION', 'GOVERNMENT', 'MEDIA', 'ECOMMERCE', 'NONPROFIT', 'MANUFACTURING', 'PROFESSIONAL_SERVICES', 'TECHNOLOGY', 'ENERGY', 'LEGAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Region" AS ENUM ('NA', 'EMEA', 'APAC', 'LATAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AccountTier" AS ENUM ('ENTERPRISE', 'MID_MARKET', 'SMB');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RfpSource" AS ENUM ('DIRECT_INVITE', 'PUBLIC_TENDER', 'REFERRAL', 'PARTNER', 'REPEAT_CLIENT', 'INBOUND', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EngagementOutcome" AS ENUM ('WON', 'LOST', 'NO_DECISION', 'WITHDRAWN', 'PARTIAL_WIN', 'DEFERRED', 'NOT_SUBMITTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LossReason" AS ENUM ('PRICE_TOO_HIGH', 'SCOPE_MISMATCH', 'COMPETITOR_PREFERRED', 'TIMELINE_MISMATCH', 'BUDGET_CUT', 'RELATIONSHIP', 'TECHNICAL_FIT', 'NO_DECISION_MADE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WorkflowPath" AS ENUM ('NO_RESPONSE', 'HAS_RESPONSE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TechStack" AS ENUM ('DRUPAL', 'DRUPAL_NEXTJS', 'WORDPRESS', 'WORDPRESS_NEXTJS', 'NEXTJS', 'REACT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EngagementType" AS ENUM ('NEW_BUILD', 'MIGRATION', 'REDESIGN', 'ENHANCEMENT', 'DISCOVERY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ShareAccessLevel" AS ENUM ('READ_ONLY', 'FULL_ACCESS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PhaseStatus" AS ENUM ('PENDING', 'RUNNING', 'REVIEW', 'APPROVED', 'SKIPPED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ArtefactType" AS ENUM ('TOR_ASSESSMENT', 'QUESTIONS', 'ESTIMATE', 'PROPOSAL', 'GAP_ANALYSIS', 'RESEARCH', 'REVIEW', 'RESPONSE_ANALYSIS', 'ESTIMATE_STATE', 'ANNEXURE', 'PREREQUISITES', 'RESPONSE_FORMAT', 'LEGACY_ACCESS_CHECKLIST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AssumptionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'CONFIRMED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AssumptionCategory" AS ENUM ('SCOPE', 'REGULATORY', 'INTEGRATION', 'MIGRATION', 'OPERATIONAL', 'PERFORMANCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAUSED', 'REVIEW', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'SKIPPED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PromptCategory" AS ENUM ('SYSTEM_BASE', 'PHASE_PROMPT', 'CARL_RULES', 'BENCHMARK', 'TEMPLATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "avatarUrl" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "blockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industry" "Industry" NOT NULL DEFAULT 'OTHER',
    "region" "Region",
    "accountTier" "AccountTier",
    "primaryContact" TEXT,
    "contactEmail" TEXT,
    "crmExternalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Engagement" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "projectName" TEXT,
    "techStack" "TechStack" NOT NULL,
    "engagementType" "EngagementType" NOT NULL DEFAULT 'NEW_BUILD',
    "status" "EngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowPath" "WorkflowPath",
    "templateFileUrl" TEXT,
    "templateStatus" JSONB,
    "accountId" TEXT,
    "rfpSource" "RfpSource",
    "estimatedDealValue" DOUBLE PRECISION,
    "dealCurrency" TEXT DEFAULT 'USD',
    "submissionDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "presalesOwner" TEXT,
    "salesOwner" TEXT,
    "isCompetitiveBid" BOOLEAN DEFAULT true,
    "numberOfCompetitors" INTEGER,
    "presalesHoursSpent" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importSource" TEXT,
    "importFilePath" TEXT,
    "importedAt" TIMESTAMP(3),
    "financialProposalValue" DOUBLE PRECISION,
    "estimatedBudget" DOUBLE PRECISION,
    "deliveryTimeline" TEXT,
    "rfpIssuedAt" TIMESTAMP(3),
    "techStackCustom" TEXT,
    "techStackIsCustom" BOOLEAN NOT NULL DEFAULT false,
    "projectDescription" TEXT,
    "legacyPlatform" TEXT,
    "legacyPlatformUrl" TEXT,
    "outcome" "EngagementOutcome",
    "lossReason" "LossReason",
    "lossReasonDetail" TEXT,
    "winFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitorWhoWon" TEXT,
    "actualContractValue" DOUBLE PRECISION,
    "outcomeFeedback" TEXT,
    "outcomeRecordedAt" TIMESTAMP(3),
    "outcomeRecordedBy" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EngagementShare" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "accessLevel" "ShareAccessLevel" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "EngagementShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Phase" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "phaseNumber" TEXT NOT NULL,
    "status" "PhaseStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "agentSessionId" TEXT,
    "modelOverride" TEXT,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PhaseArtefact" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "artefactType" "ArtefactType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT,
    "contentMd" TEXT,
    "fileUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseArtefact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Assumption" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "sourcePhaseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "torReference" TEXT,
    "impactIfWrong" TEXT NOT NULL,
    "status" "AssumptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "confirmedById" TEXT,
    "code" TEXT,
    "category" "AssumptionCategory" NOT NULL DEFAULT 'SCOPE',
    "tab" TEXT,
    "regulationContext" TEXT,
    "crBoundaryEffect" TEXT,
    "clauseRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RiskRegisterEntry" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "conf" INTEGER NOT NULL,
    "risk" TEXT NOT NULL,
    "openQuestion" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "hoursAtRisk" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskRegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Benchmark" (
    "id" TEXT NOT NULL,
    "techStack" "TechStack" NOT NULL,
    "category" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "lowHours" DOUBLE PRECISION NOT NULL,
    "highHours" DOUBLE PRECISION NOT NULL,
    "tier" TEXT,
    "notes" TEXT,
    "sourceEngagementId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PhaseExecution" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phaseNumber" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "modelId" TEXT,
    "estimatedCostUsd" DOUBLE PRECISION,
    "apiCallCount" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "confirmedFiles" INTEGER NOT NULL DEFAULT 0,
    "skippedFiles" INTEGER NOT NULL DEFAULT 0,
    "zipHash" TEXT,
    "autoConfirmThreshold" DOUBLE PRECISION,
    "batchId" TEXT,
    "errorMessage" TEXT,
    "estimatedCostUsd" DOUBLE PRECISION,
    "actualCostUsd" DOUBLE PRECISION,
    "inputTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "outputTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportItem" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "primaryFileName" TEXT,
    "inferredClient" TEXT,
    "inferredIndustry" TEXT,
    "inferredTechStack" TEXT,
    "inferredEngagementType" TEXT,
    "inferredProjectName" TEXT,
    "inferredSubmissionDeadline" TIMESTAMP(3),
    "inferredIssueDate" TIMESTAMP(3),
    "inferredDealValue" DOUBLE PRECISION,
    "inferredFinancialValue" DOUBLE PRECISION,
    "confidence" JSONB,
    "extractedTextPreview" TEXT,
    "processedFiles" JSONB,
    "matchedAccountId" TEXT,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "engagementId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EngagementStageSummary" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "phaseNumber" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "keyFindings" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementStageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassificationCorrection" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalType" TEXT NOT NULL,
    "correctedType" TEXT NOT NULL,
    "originalConfidence" DOUBLE PRECISION NOT NULL,
    "textSnippet" TEXT,
    "correctedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "PromptCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptVersion" (
    "id" TEXT NOT NULL,
    "promptConfigId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptOverride" (
    "id" TEXT NOT NULL,
    "phaseNumber" TEXT NOT NULL,
    "promptType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TorRequirement" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "normalizedClauseRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "clarityRating" TEXT NOT NULL,
    "sourcePhaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TorRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LineItem" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "conf" INTEGER NOT NULL,
    "lowHrs" DOUBLE PRECISION NOT NULL,
    "highHrs" DOUBLE PRECISION NOT NULL,
    "benchmarkRef" TEXT,
    "integrationTier" TEXT,
    "orphanJustification" TEXT,
    "sourcePhaseId" TEXT,
    "benchmarkLowHrs" DOUBLE PRECISION,
    "benchmarkHighHrs" DOUBLE PRECISION,
    "deviationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ValidationReport" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "phaseNumber" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallStatus" TEXT NOT NULL,
    "accuracyScore" DOUBLE PRECISION NOT NULL,
    "gapCount" INTEGER NOT NULL DEFAULT 0,
    "orphanCount" INTEGER NOT NULL DEFAULT 0,
    "confFormulaViolations" INTEGER NOT NULL DEFAULT 0,
    "noBenchmarkCount" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB NOT NULL,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiCallLog" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT,
    "phase" TEXT,
    "model" TEXT NOT NULL,
    "promptHash" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "validationOutcome" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmbeddingChunk" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "engagementId" TEXT,
    "question" TEXT NOT NULL,
    "chunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answerPreview" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GapFixRun" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "jobId" TEXT,
    "triggeredBy" TEXT DEFAULT 'manual',
    "gapsBefore" JSONB NOT NULL,
    "scoresBefore" JSONB,
    "scoresAfter" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GapFixRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TechStackResearch" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "stackDescription" TEXT NOT NULL,
    "ecosystemSummary" TEXT NOT NULL,
    "benchmarksMarkdown" TEXT NOT NULL,
    "sourcesJson" JSONB NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechStackResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssumptionToTorRequirement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AssumptionToTorRequirement_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AssumptionToLineItem" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AssumptionToLineItem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_RiskToAssumption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RiskToAssumption_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_LineItemToTorRequirement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LineItemToTorRequirement_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_RiskToLineItem" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RiskToLineItem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Account_canonicalName_key" ON "Account"("canonicalName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Engagement_accountId_idx" ON "Engagement"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EngagementShare_email_idx" ON "EngagementShare"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EngagementShare_userId_idx" ON "EngagementShare"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EngagementShare_engagementId_revokedAt_idx" ON "EngagementShare"("engagementId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EngagementShare_engagementId_email_key" ON "EngagementShare"("engagementId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Phase_engagementId_phaseNumber_key" ON "Phase"("engagementId", "phaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PhaseArtefact_phaseId_artefactType_version_key" ON "PhaseArtefact"("phaseId", "artefactType", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Assumption_engagementId_code_idx" ON "Assumption"("engagementId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Benchmark_techStack_category_idx" ON "Benchmark"("techStack", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhaseExecution_engagementId_idx" ON "PhaseExecution"("engagementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhaseExecution_userId_idx" ON "PhaseExecution"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_batchId_idx" ON "ImportJob"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportItem_importJobId_idx" ON "ImportItem"("importJobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EngagementStageSummary_engagementId_idx" ON "EngagementStageSummary"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EngagementStageSummary_engagementId_phaseNumber_key" ON "EngagementStageSummary"("engagementId", "phaseNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClassificationCorrection_correctedType_idx" ON "ClassificationCorrection"("correctedType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromptConfig_key_key" ON "PromptConfig"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptVersion_promptConfigId_idx" ON "PromptVersion"("promptConfigId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptOverride_phaseNumber_promptType_isActive_idx" ON "PromptOverride"("phaseNumber", "promptType", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TorRequirement_engagementId_idx" ON "TorRequirement"("engagementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TorRequirement_engagementId_normalizedClauseRef_idx" ON "TorRequirement"("engagementId", "normalizedClauseRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LineItem_engagementId_tab_idx" ON "LineItem"("engagementId", "tab");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ValidationReport_engagementId_phaseNumber_idx" ON "ValidationReport"("engagementId", "phaseNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ValidationReport_engagementId_ranAt_idx" ON "ValidationReport"("engagementId", "ranAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiCallLog_engagementId_idx" ON "AiCallLog"("engagementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiCallLog_createdAt_idx" ON "AiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_engagementId_idx" ON "EmbeddingChunk"("engagementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_sourceType_idx" ON "EmbeddingChunk"("sourceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_engagementId_sourceType_idx" ON "EmbeddingChunk"("engagementId", "sourceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatAuditLog_userId_createdAt_idx" ON "ChatAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatAuditLog_engagementId_createdAt_idx" ON "ChatAuditLog"("engagementId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GapFixRun_engagementId_createdAt_idx" ON "GapFixRun"("engagementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TechStackResearch_engagementId_key" ON "TechStackResearch"("engagementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AssumptionToTorRequirement_B_index" ON "_AssumptionToTorRequirement"("B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AssumptionToLineItem_B_index" ON "_AssumptionToLineItem"("B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_RiskToAssumption_B_index" ON "_RiskToAssumption"("B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_LineItemToTorRequirement_B_index" ON "_LineItemToTorRequirement"("B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_RiskToLineItem_B_index" ON "_RiskToLineItem"("B");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EngagementShare" ADD CONSTRAINT "EngagementShare_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EngagementShare" ADD CONSTRAINT "EngagementShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EngagementShare" ADD CONSTRAINT "EngagementShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Phase" ADD CONSTRAINT "Phase_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PhaseArtefact" ADD CONSTRAINT "PhaseArtefact_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RiskRegisterEntry" ADD CONSTRAINT "RiskRegisterEntry_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EngagementStageSummary" ADD CONSTRAINT "EngagementStageSummary_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptConfigId_fkey" FOREIGN KEY ("promptConfigId") REFERENCES "PromptConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TorRequirement" ADD CONSTRAINT "TorRequirement_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EmbeddingChunk" ADD CONSTRAINT "EmbeddingChunk_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "GapFixRun" ADD CONSTRAINT "GapFixRun_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TechStackResearch" ADD CONSTRAINT "TechStackResearch_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_AssumptionToTorRequirement" ADD CONSTRAINT "_AssumptionToTorRequirement_A_fkey" FOREIGN KEY ("A") REFERENCES "Assumption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_AssumptionToTorRequirement" ADD CONSTRAINT "_AssumptionToTorRequirement_B_fkey" FOREIGN KEY ("B") REFERENCES "TorRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_AssumptionToLineItem" ADD CONSTRAINT "_AssumptionToLineItem_A_fkey" FOREIGN KEY ("A") REFERENCES "Assumption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_AssumptionToLineItem" ADD CONSTRAINT "_AssumptionToLineItem_B_fkey" FOREIGN KEY ("B") REFERENCES "LineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_RiskToAssumption" ADD CONSTRAINT "_RiskToAssumption_A_fkey" FOREIGN KEY ("A") REFERENCES "Assumption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_RiskToAssumption" ADD CONSTRAINT "_RiskToAssumption_B_fkey" FOREIGN KEY ("B") REFERENCES "RiskRegisterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_LineItemToTorRequirement" ADD CONSTRAINT "_LineItemToTorRequirement_A_fkey" FOREIGN KEY ("A") REFERENCES "LineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_LineItemToTorRequirement" ADD CONSTRAINT "_LineItemToTorRequirement_B_fkey" FOREIGN KEY ("B") REFERENCES "TorRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_RiskToLineItem" ADD CONSTRAINT "_RiskToLineItem_A_fkey" FOREIGN KEY ("A") REFERENCES "LineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "_RiskToLineItem" ADD CONSTRAINT "_RiskToLineItem_B_fkey" FOREIGN KEY ("B") REFERENCES "RiskRegisterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

