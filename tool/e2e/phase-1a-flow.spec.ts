// @slow — tagged for CI-only (not in pre-commit gate)
// This test exercises the full Phase 0 → 1 → 1A flow with a mocked AI backend.
// The mock intercepts all Anthropic SDK calls and returns deterministic fixture responses.
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

// Only run this in CI where the fixture API mock server is available.
test.skip(
  !process.env.CI && !process.env.RUN_SLOW_TESTS,
  "Slow test — skipped locally. Set RUN_SLOW_TESTS=1 or run in CI."
);

test.describe("Phase 1A flow — SA enrichment fields populated", () => {
  let engagementId: string;

  test("creates engagement and runs through Phase 0, 1, 1A", async ({ page, request }) => {
    // Create engagement via API (seeded test user session required in E2E env)
    const res = await request.post("/api/engagements", {
      data: {
        clientName: "HIPAA Test Corp",
        techStack: "DRUPAL",
        engagementType: "NEW_BUILD",
      },
    });
    expect(res.status()).toBeLessThan(300);
    const { id } = await res.json();
    engagementId = id;

    // Navigate to engagement and verify it loaded
    await page.goto(`/engagements/${id}`);
    await expect(page.locator("text=HIPAA Test Corp")).toBeVisible({ timeout: 10_000 });
  });

  test("after Phase 1A completes, at least one REGULATORY assumption exists", async ({ request }) => {
    if (!engagementId) test.skip();

    // Poll for APPROVED phase status (AI runs asynchronously via BullMQ)
    let phase1aApproved = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4_000));
      const res = await request.get(`/api/engagements/${engagementId}`);
      if (!res.ok()) continue;
      const data = await res.json();
      const phase1a = data.phases?.find((p: { phaseNumber: string }) => p.phaseNumber === "1A");
      if (phase1a?.status === "APPROVED" || phase1a?.status === "REVIEW") {
        phase1aApproved = true;
        break;
      }
    }
    expect(phase1aApproved).toBe(true);

    // Check assumptions endpoint
    const assumptionsRes = await request.get(`/api/engagements/${engagementId}/assumptions`);
    expect(assumptionsRes.status()).toBe(200);
    const assumptions = await assumptionsRes.json();

    const regulatory = assumptions.filter(
      (a: { category: string }) => a.category === "REGULATORY"
    );
    // With a HIPAA-containing TOR, the model should emit at least one REGULATORY assumption
    expect(regulatory.length).toBeGreaterThanOrEqual(1);
  });

  test("line items have benchmarkLowHrs populated", async ({ request }) => {
    if (!engagementId) test.skip();

    const res = await request.get(`/api/engagements/${engagementId}/line-items`);
    expect(res.status()).toBe(200);
    const items = await res.json();
    const withBenchmark = items.filter(
      (li: { benchmarkLowHrs: number | null }) => li.benchmarkLowHrs != null
    );
    expect(withBenchmark.length).toBeGreaterThan(0);
  });
});
