import { describe, it, expect } from "vitest";
import { createCodeGenerator } from "@/lib/ai/assumption-code";

describe("createCodeGenerator", () => {
  it("generates codes in sequence per category", () => {
    const gen = createCodeGenerator();
    expect(gen("SCOPE")).toBe("A-SC-001");
    expect(gen("SCOPE")).toBe("A-SC-002");
    expect(gen("REGULATORY")).toBe("A-RG-001");
    expect(gen("SCOPE")).toBe("A-SC-003");
  });

  it("zero-pads to 3 digits", () => {
    const gen = createCodeGenerator();
    for (let i = 0; i < 9; i++) gen("SCOPE");
    expect(gen("SCOPE")).toBe("A-SC-010");
  });

  it("handles all category prefixes", () => {
    const gen = createCodeGenerator();
    const cases: [string, string][] = [
      ["SCOPE", "A-SC-001"],
      ["REGULATORY", "A-RG-001"],
      ["INTEGRATION", "A-IN-001"],
      ["MIGRATION", "A-MG-001"],
      ["OPERATIONAL", "A-OP-001"],
      ["PERFORMANCE", "A-PF-001"],
    ];
    for (const [category, expected] of cases) {
      expect(gen(category)).toBe(expected);
    }
  });

  it("falls back to SC prefix for unknown categories", () => {
    const gen = createCodeGenerator();
    expect(gen("TOTALLY_UNKNOWN")).toBe("A-SC-001");
  });

  it("each generator instance has independent state", () => {
    const gen1 = createCodeGenerator();
    const gen2 = createCodeGenerator();
    gen1("SCOPE");
    gen1("SCOPE");
    expect(gen2("SCOPE")).toBe("A-SC-001");
  });
});
