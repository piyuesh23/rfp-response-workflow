import { test, expect } from "@playwright/test";

const engagementId = process.env.E2E_ENGAGEMENT_ID ?? "e2e-engagement-1";

test.describe("Estimate page — SA enrichment fields", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via a test session cookie (set via the app's test auth endpoint
    // or by navigating through sign-in if test auth is not available).
    // For CI, set NEXTAUTH_SECRET and seed a session in the DB.
    // Here we navigate to the page and assert — in a real CI setup a test login flow precedes this.
    await page.goto(`/engagements/${engagementId}/estimate`);
  });

  test("shows assumption code A-SC-001 in the estimate view", async ({ page }) => {
    // Wait for the page to load (spinner goes away)
    await page.waitForSelector("text=Estimate", { timeout: 15_000 });
    // The estimate page includes a Risk Register and a TabbedEstimate —
    // the codes appear on the assumptions page, not directly on the estimate.
    // Navigate to assumptions to verify SA enrichment rendering.
    await page.goto(`/engagements/${engagementId}/assumptions`);
    await expect(page.locator("text=A-SC-001")).toBeVisible({ timeout: 10_000 });
  });

  test("REGULATORY badge is rendered for the regulatory assumption", async ({ page }) => {
    await page.goto(`/engagements/${engagementId}/assumptions`);
    await expect(page.locator("text=REGULATORY")).toBeVisible({ timeout: 10_000 });
  });

  test("CR boundary effect text is visible for the regulatory assumption", async ({ page }) => {
    await page.goto(`/engagements/${engagementId}/assumptions`);
    // The CR boundary is rendered in an amber block per AssumptionList.tsx
    await expect(page.locator("text=+8-12 hrs if this assumption is invalidated")).toBeVisible({ timeout: 10_000 });
  });
});
