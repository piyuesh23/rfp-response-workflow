import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractAssumptionsSidecar,
  extractEstimateSidecar,
} from "@/lib/ai/sidecar-extractors";

function wrapSidecar(key: string, payload: unknown): string {
  return `<!-- ${key}\n${JSON.stringify(payload)}\n-->`;
}

describe("extractAssumptionsSidecar", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns null when block is absent", () => {
    expect(extractAssumptionsSidecar("No sidecar here")).toBeNull();
  });

  it("happy path — returns parsed assumptions", () => {
    const payload = {
      assumptions: [
        {
          text: "Client is on Drupal 10",
          torReference: "TOR-1",
          impactIfWrong: "+8 hrs",
          category: "SCOPE",
          tab: "BACKEND",
          regulationContext: null,
          crBoundaryEffect: "+8 hrs if changed",
          clauseRef: null,
        },
      ],
    };
    const md = wrapSidecar("ASSUMPTIONS-JSON", payload);
    const result = extractAssumptionsSidecar(md);
    expect(result).not.toBeNull();
    expect(result!.assumptions).toHaveLength(1);
    expect(result!.assumptions[0].text).toBe("Client is on Drupal 10");
    expect(result!.assumptions[0].category).toBe("SCOPE");
  });

  it("returns null and warns on malformed JSON", () => {
    const md = "<!-- ASSUMPTIONS-JSON {bad json} -->";
    const result = extractAssumptionsSidecar(md);
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("ASSUMPTIONS-JSON: JSON parse failed")
    );
  });

  it("per-item salvage — returns valid items, skips invalid", () => {
    const payload = {
      assumptions: [
        { text: "Valid assumption", category: "SCOPE", impactIfWrong: "Some impact" },
        { text: "" }, // invalid: text empty
        { text: "Another valid", category: "REGULATORY", impactIfWrong: "Compliance risk" },
      ],
    };
    const md = wrapSidecar("ASSUMPTIONS-JSON", payload);
    const result = extractAssumptionsSidecar(md);
    // All 3 are actually valid with .catch("SCOPE") and .default("") —
    // the empty text triggers min(1) failure
    expect(result).not.toBeNull();
    const texts = result!.assumptions.map((a) => a.text);
    expect(texts).toContain("Valid assumption");
    expect(texts).toContain("Another valid");
    expect(texts).not.toContain("");
  });

  it("unknown category falls back to SCOPE via .catch", () => {
    const payload = {
      assumptions: [
        {
          text: "Some assumption",
          category: "TOTALLY_UNKNOWN_CATEGORY",
          impactIfWrong: "Risk",
        },
      ],
    };
    const md = wrapSidecar("ASSUMPTIONS-JSON", payload);
    const result = extractAssumptionsSidecar(md);
    expect(result).not.toBeNull();
    expect(result!.assumptions[0].category).toBe("SCOPE");
  });

  it("REGULATORY category round-trips correctly", () => {
    const payload = {
      assumptions: [
        {
          text: "HIPAA encryption at rest required",
          category: "REGULATORY",
          regulationContext: "HIPAA §164.312(a)(2)(iv)",
          crBoundaryEffect: "+20-30 hrs if storage provider changes",
          impactIfWrong: "Compliance failure",
        },
      ],
    };
    const md = wrapSidecar("ASSUMPTIONS-JSON", payload);
    const result = extractAssumptionsSidecar(md);
    expect(result!.assumptions[0].category).toBe("REGULATORY");
    expect(result!.assumptions[0].regulationContext).toBe("HIPAA §164.312(a)(2)(iv)");
    expect(result!.assumptions[0].crBoundaryEffect).toBe("+20-30 hrs if storage provider changes");
  });
});

describe("EstimateLineItemSchema (via extractEstimateSidecar)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("accepts SA enrichment fields benchmarkLowHrs / benchmarkHighHrs / deviationReason", () => {
    const payload = {
      lineItems: [
        {
          tab: "BACKEND",
          task: "API setup",
          description: "REST scaffolding",
          hours: 8,
          conf: 5,
          lowHrs: 8,
          highHrs: 10,
          benchmarkRef: "drupal-api-crud",
          integrationTier: null,
          torClauseRefs: [],
          benchmarkLowHrs: 6,
          benchmarkHighHrs: 12,
          deviationReason: null,
        },
      ],
    };
    const md = wrapSidecar("ESTIMATE-LINEITEMS-JSON", payload);
    const result = extractEstimateSidecar(md);
    expect(result).not.toBeNull();
    expect(result!.lineItems[0].benchmarkLowHrs).toBe(6);
    expect(result!.lineItems[0].benchmarkHighHrs).toBe(12);
  });

  it("rejects negative hours", () => {
    const payload = {
      lineItems: [
        {
          tab: "BACKEND",
          task: "Bad item",
          description: "",
          hours: -4,
          conf: 5,
          lowHrs: -4,
          highHrs: -4,
        },
      ],
    };
    const md = wrapSidecar("ESTIMATE-LINEITEMS-JSON", payload);
    const result = extractEstimateSidecar(md);
    // No valid items → null or empty (salvage drops the bad item)
    if (result !== null) {
      expect(result.lineItems).toHaveLength(0);
    } else {
      expect(result).toBeNull();
    }
  });
});
