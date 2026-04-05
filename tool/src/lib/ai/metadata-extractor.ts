/**
 * Extracts structured metadata from AI-generated phase markdown content.
 * Used by phase-runner to persist metadata on PhaseArtefact for stats API.
 */

export interface EstimateMetadata {
  totalHours: { low: number; high: number };
  hoursByTab: {
    backend: { low: number; high: number };
    frontend: { low: number; high: number };
    fixedCost: { low: number; high: number };
    ai: { low: number; high: number };
  };
  confidenceDistribution: { high56: number; medium4: number; low123: number };
  lineItemCount: number;
}

export interface AssessmentMetadata {
  requirementCount: number;
  clarityBreakdown: {
    clear: number;
    needsClarification: number;
    ambiguous: number;
    missingDetail: number;
  };
}

export interface ResearchMetadata {
  integrationsFound: number;
  hiddenScopeItems: number;
  riskCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse a markdown table and return rows as arrays of cell strings. */
function parseTableRows(markdown: string, headerPattern: RegExp): string[][] {
  const rows: string[][] = [];
  const lines = markdown.split("\n");

  let inSection = false;
  let headerFound = false;

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      headerFound = false;
      continue;
    }

    if (inSection) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // End section on next heading
      if (/^#{1,3}\s/.test(trimmed) && !headerPattern.test(trimmed)) {
        inSection = false;
        continue;
      }

      // Skip separator rows (|---|---|)
      if (/^\|[\s-:|]+\|$/.test(trimmed)) {
        headerFound = true;
        continue;
      }

      // Skip header row (first table row before separator)
      if (!headerFound && trimmed.startsWith("|")) continue;

      // Parse data row
      if (headerFound && trimmed.startsWith("|")) {
        const cells = trimmed
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length > 0) rows.push(cells);
      }
    }
  }

  return rows;
}

/** Extract hours and conf from a table row, given column indices. */
function extractHoursConf(
  row: string[],
  hoursIdx: number,
  confIdx: number,
  lowIdx: number,
  highIdx: number
): { hours: number; conf: number; low: number; high: number } | null {
  const hours = parseFloat(row[hoursIdx]);
  const conf = parseInt(row[confIdx], 10);
  const low = parseFloat(row[lowIdx]);
  const high = parseFloat(row[highIdx]);

  if (isNaN(hours) && isNaN(low)) return null;

  return {
    hours: isNaN(hours) ? low : hours,
    conf: isNaN(conf) ? 4 : conf,
    low: isNaN(low) ? hours : low,
    high: isNaN(high) ? hours : high,
  };
}

// ─── Summary table parser ───────────────────────────────────────────────────

/** Try to parse the Summary table at the top of the estimate. */
function parseSummaryTable(markdown: string): EstimateMetadata | null {
  // Find the Summary section and extract the header row to detect column positions
  const lines = markdown.split("\n");
  let inSummary = false;
  let headerCells: string[] | null = null;
  let pastSeparator = false;
  const dataRows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+Summary/i.test(trimmed)) {
      inSummary = true;
      headerCells = null;
      pastSeparator = false;
      continue;
    }

    if (inSummary && /^#{1,3}\s/.test(trimmed) && !/^##\s+Summary/i.test(trimmed)) {
      break; // next section
    }

    if (!inSummary || !trimmed.startsWith("|")) continue;

    // Separator row
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      if (headerCells) pastSeparator = true;
      continue;
    }

    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());

    if (!headerCells) {
      headerCells = cells;
      continue;
    }

    if (pastSeparator) {
      dataRows.push(cells);
    }
  }

  if (!headerCells || dataRows.length === 0) return null;

  // Detect column positions from header
  const h = headerCells.map((c) => c.toLowerCase().replace(/\*+/g, "").trim());
  const tabCol = h.findIndex((c) => c.includes("tab") || c.includes("category") || c.includes("area"));
  const lowCol = h.findIndex((c) => c.includes("low"));
  const highCol = h.findIndex((c) => c.includes("high"));
  const lineItemCol = h.findIndex((c) => c.includes("line") || c.includes("item") || c.includes("count"));

  // Fallback: first column is tab name, then look for numeric columns
  const tabIdx = tabCol >= 0 ? tabCol : 0;
  const lowIdx = lowCol >= 0 ? lowCol : 1;
  const highIdx = highCol >= 0 ? highCol : 2;

  const result: EstimateMetadata = {
    totalHours: { low: 0, high: 0 },
    hoursByTab: {
      backend: { low: 0, high: 0 },
      frontend: { low: 0, high: 0 },
      fixedCost: { low: 0, high: 0 },
      ai: { low: 0, high: 0 },
    },
    confidenceDistribution: { high56: 0, medium4: 0, low123: 0 },
    lineItemCount: 0,
  };

  for (const row of dataRows) {
    const tabName = (row[tabIdx] ?? "").toLowerCase().replace(/\*+/g, "").trim();
    const lowHrs = parseFloat((row[lowIdx] ?? "").replace(/[*,]/g, ""));
    const highHrs = parseFloat((row[highIdx] ?? "").replace(/[*,]/g, ""));
    const lineItems = lineItemCol >= 0 ? parseInt((row[lineItemCol] ?? "").replace(/[*,]/g, ""), 10) : NaN;

    if (tabName.includes("total")) {
      result.totalHours = {
        low: isNaN(lowHrs) ? 0 : lowHrs,
        high: isNaN(highHrs) ? 0 : highHrs,
      };
      result.lineItemCount = isNaN(lineItems) ? 0 : lineItems;
    } else if (tabName.includes("backend")) {
      result.hoursByTab.backend = { low: lowHrs || 0, high: highHrs || 0 };
    } else if (tabName.includes("frontend")) {
      result.hoursByTab.frontend = { low: lowHrs || 0, high: highHrs || 0 };
    } else if (tabName.includes("fixed")) {
      result.hoursByTab.fixedCost = { low: lowHrs || 0, high: highHrs || 0 };
    } else if (tabName.includes("ai")) {
      result.hoursByTab.ai = { low: lowHrs || 0, high: highHrs || 0 };
    }
  }

  return result;
}

// ─── Line-item-level parser (fallback when no summary table) ────────────────

function parseEstimateFromLineItems(markdown: string): EstimateMetadata {
  const result: EstimateMetadata = {
    totalHours: { low: 0, high: 0 },
    hoursByTab: {
      backend: { low: 0, high: 0 },
      frontend: { low: 0, high: 0 },
      fixedCost: { low: 0, high: 0 },
      ai: { low: 0, high: 0 },
    },
    confidenceDistribution: { high56: 0, medium4: 0, low123: 0 },
    lineItemCount: 0,
  };

  // Identify tab sections: "# Backend Tab", "## Backend Development Estimates", etc.
  const tabSections: { tab: keyof typeof result.hoursByTab; pattern: RegExp }[] = [
    { tab: "backend", pattern: /^#{1,2}\s+Backend\b/i },
    { tab: "frontend", pattern: /^#{1,2}\s+Frontend\b/i },
    { tab: "fixedCost", pattern: /^#{1,2}\s+Fixed\s+Cost/i },
    { tab: "ai", pattern: /^#{1,2}\s+AI\b/i },
  ];

  const lines = markdown.split("\n");
  let currentTab: keyof typeof result.hoursByTab | null = null;
  let inTable = false;
  let colMap: { hours: number; conf: number; low: number; high: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for tab section headers
    for (const { tab, pattern } of tabSections) {
      if (pattern.test(trimmed)) {
        currentTab = tab;
        inTable = false;
        colMap = null;
        break;
      }
    }

    // Stop at Risk Register or Assumption Register
    if (/^##?\s+(Risk\s+Register|Assumption\s+Register)/i.test(trimmed)) {
      currentTab = null;
      continue;
    }

    if (!currentTab) continue;

    // Detect table header to find column positions
    if (trimmed.startsWith("|") && trimmed.toLowerCase().includes("hours") && !inTable) {
      const headers = trimmed.split("|").slice(1, -1).map((h) => h.trim().toLowerCase());
      const hoursIdx = headers.findIndex((h) => h === "hours");
      const confIdx = headers.findIndex((h) => h === "conf");
      const lowIdx = headers.findIndex((h) => h.includes("low"));
      const highIdx = headers.findIndex((h) => h.includes("high"));

      if ((hoursIdx >= 0 || lowIdx >= 0) && confIdx >= 0) {
        colMap = {
          hours: hoursIdx >= 0 ? hoursIdx : lowIdx,
          conf: confIdx,
          low: lowIdx >= 0 ? lowIdx : hoursIdx,
          high: highIdx >= 0 ? highIdx : hoursIdx,
        };
      }
      continue;
    }

    // Skip separator
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      if (colMap) inTable = true;
      continue;
    }

    // Parse data rows
    if (inTable && colMap && trimmed.startsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      const parsed = extractHoursConf(cells, colMap.hours, colMap.conf, colMap.low, colMap.high);
      if (parsed) {
        result.hoursByTab[currentTab].low += parsed.low;
        result.hoursByTab[currentTab].high += parsed.high;
        result.lineItemCount++;

        if (parsed.conf >= 5) result.confidenceDistribution.high56++;
        else if (parsed.conf === 4) result.confidenceDistribution.medium4++;
        else result.confidenceDistribution.low123++;
      }
    }

    // Reset table state on new subsection heading
    if (/^#{2,3}\s/.test(trimmed) && !trimmed.toLowerCase().includes("tab")) {
      inTable = false;
      colMap = null;
    }
  }

  // Compute totals
  for (const tab of ["backend", "frontend", "fixedCost", "ai"] as const) {
    result.totalHours.low += result.hoursByTab[tab].low;
    result.totalHours.high += result.hoursByTab[tab].high;
  }

  return result;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function extractEstimateMetadata(contentMd: string): EstimateMetadata {
  // Try summary table first, fall back to line-item parsing
  const fromSummary = parseSummaryTable(contentMd);
  if (fromSummary && fromSummary.totalHours.low > 0) {
    // Still need confidence distribution from line items
    const fromLines = parseEstimateFromLineItems(contentMd);
    fromSummary.confidenceDistribution = fromLines.confidenceDistribution;
    fromSummary.lineItemCount = fromLines.lineItemCount || fromSummary.lineItemCount;
    return fromSummary;
  }
  return parseEstimateFromLineItems(contentMd);
}

export function extractAssessmentMetadata(contentMd: string): AssessmentMetadata {
  const result: AssessmentMetadata = {
    requirementCount: 0,
    clarityBreakdown: { clear: 0, needsClarification: 0, ambiguous: 0, missingDetail: 0 },
  };

  // Parse the Requirements Assessment table
  const rows = parseTableRows(contentMd, /^##\s+Requirements\s+Assessment/i);

  for (const row of rows) {
    // Clarity Rating is typically column index 3
    const clarity = (row[3] ?? "").toLowerCase().trim();
    result.requirementCount++;

    if (clarity.includes("clear") && !clarity.includes("needs")) {
      result.clarityBreakdown.clear++;
    } else if (clarity.includes("needs clarification")) {
      result.clarityBreakdown.needsClarification++;
    } else if (clarity.includes("ambiguous")) {
      result.clarityBreakdown.ambiguous++;
    } else if (clarity.includes("missing")) {
      result.clarityBreakdown.missingDetail++;
    } else {
      // Default: needs clarification
      result.clarityBreakdown.needsClarification++;
    }
  }

  // If no rows found, try to find Domain Summary table
  if (result.requirementCount === 0) {
    const domainRows = parseTableRows(contentMd, /^###?\s+Domain\s+Summary/i);
    for (const row of domainRows) {
      const total = parseInt(row[1] ?? "", 10);
      const clear = parseInt(row[2] ?? "", 10);
      const needs = parseInt(row[3] ?? "", 10);
      const ambiguous = parseInt(row[4] ?? "", 10);
      const missing = parseInt(row[5] ?? "", 10);

      if (!isNaN(total)) result.requirementCount += total;
      if (!isNaN(clear)) result.clarityBreakdown.clear += clear;
      if (!isNaN(needs)) result.clarityBreakdown.needsClarification += needs;
      if (!isNaN(ambiguous)) result.clarityBreakdown.ambiguous += ambiguous;
      if (!isNaN(missing)) result.clarityBreakdown.missingDetail += missing;
    }
  }

  // Fallback: parse "Clarity Assessment Summary" table (Rating | Count format)
  if (result.requirementCount === 0) {
    const clarityRows = parseTableRows(contentMd, /^#{2,3}\s+Clarity\s+(?:Assessment\s+)?Summary/i);
    for (const row of clarityRows) {
      const rating = (row[0] ?? "").toLowerCase().replace(/\*+/g, "").trim();
      const count = parseInt((row[1] ?? "").replace(/\*+/g, "").trim(), 10);
      if (isNaN(count)) continue;

      if (rating.includes("total")) {
        result.requirementCount = count;
      } else if (rating === "clear") {
        result.clarityBreakdown.clear = count;
      } else if (rating.includes("needs")) {
        result.clarityBreakdown.needsClarification = count;
      } else if (rating.includes("ambiguous")) {
        result.clarityBreakdown.ambiguous = count;
      } else if (rating.includes("missing")) {
        result.clarityBreakdown.missingDetail = count;
      }
    }
    // If no total row, sum the breakdown
    if (result.requirementCount === 0) {
      result.requirementCount =
        result.clarityBreakdown.clear +
        result.clarityBreakdown.needsClarification +
        result.clarityBreakdown.ambiguous +
        result.clarityBreakdown.missingDetail;
    }
  }

  return result;
}

export function extractResearchMetadata(contentMd: string): ResearchMetadata {
  const result: ResearchMetadata = {
    integrationsFound: 0,
    hiddenScopeItems: 0,
    riskCount: 0,
  };

  // Count integration rows
  const integrationRows = parseTableRows(contentMd, /^##?\s+.*[Ii]ntegration/);
  result.integrationsFound = integrationRows.length;

  // Count hidden scope rows
  const hiddenRows = parseTableRows(contentMd, /^##?\s+.*[Hh]idden\s+[Ss]cope/);
  result.hiddenScopeItems = hiddenRows.length;

  // Count risk rows
  const riskRows = parseTableRows(contentMd, /^##?\s+.*[Rr]isk/);
  result.riskCount = riskRows.length;

  return result;
}

/** Map phase number to extractor function. Returns metadata JSON or null. */
export function extractMetadataForPhase(
  phaseNumber: string,
  contentMd: string
): Record<string, unknown> | null {
  switch (phaseNumber) {
    case "0":
      return extractResearchMetadata(contentMd) as unknown as Record<string, unknown>;
    case "1":
      return extractAssessmentMetadata(contentMd) as unknown as Record<string, unknown>;
    case "1A":
    case "3":
      return extractEstimateMetadata(contentMd) as unknown as Record<string, unknown>;
    default:
      return null;
  }
}
