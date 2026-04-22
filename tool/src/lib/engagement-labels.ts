/**
 * Shared enum label maps for engagement-related enums.
 * Single source of truth — import from here instead of defining inline.
 */

export const techStackLabels: Record<string, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  WORDPRESS: "WordPress",
  WORDPRESS_NEXTJS: "WordPress + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
  OTHER: "Other — describe below",
};

export const engagementTypeLabels: Record<string, string> = {
  NEW_BUILD: "New Build",
  MIGRATION: "Migration",
  REDESIGN: "Redesign",
  ENHANCEMENT: "Enhancement",
  DISCOVERY: "Discovery",
};

export const industryLabels: Record<string, string> = {
  HEALTHCARE: "Healthcare",
  FINTECH: "Fintech",
  EDUCATION: "Education",
  GOVERNMENT: "Government",
  MEDIA: "Media & Publishing",
  ECOMMERCE: "E-Commerce",
  NONPROFIT: "Nonprofit",
  MANUFACTURING: "Manufacturing",
  PROFESSIONAL_SERVICES: "Professional Services",
  TECHNOLOGY: "Technology",
  ENERGY: "Energy",
  LEGAL: "Legal",
  OTHER: "Other",
};

export const regionLabels: Record<string, string> = {
  NA: "North America",
  EMEA: "EMEA",
  APAC: "Asia Pacific",
  LATAM: "Latin America",
};

export const tierLabels: Record<string, string> = {
  ENTERPRISE: "Enterprise",
  MID_MARKET: "Mid-Market",
  SMB: "SMB",
};

export const outcomeLabels: Record<string, string> = {
  WON: "Won",
  LOST: "Lost",
  NO_DECISION: "No Decision",
  WITHDRAWN: "Withdrawn",
  PARTIAL_WIN: "Partial Win",
  DEFERRED: "Deferred",
  NOT_SUBMITTED: "Not Submitted",
};

export const lossReasonLabels: Record<string, string> = {
  PRICE_TOO_HIGH: "Price Too High",
  SCOPE_MISMATCH: "Scope Mismatch",
  COMPETITOR_PREFERRED: "Competitor Preferred",
  TIMELINE_MISMATCH: "Timeline Mismatch",
  BUDGET_CUT: "Budget Cut",
  RELATIONSHIP: "Relationship",
  TECHNICAL_FIT: "Technical Fit",
  NO_DECISION_MADE: "No Decision Made",
  OTHER: "Other",
};

export const rfpSourceLabels: Record<string, string> = {
  DIRECT_INVITE: "Direct Invite",
  PUBLIC_TENDER: "Public Tender",
  REFERRAL: "Referral",
  PARTNER: "Partner",
  REPEAT_CLIENT: "Repeat Client",
  INBOUND: "Inbound",
  OTHER: "Other",
};
