export const queryKeys = {
  engagements: () => ["engagements"] as const,
  engagement: (id: string) => ["engagement", id] as const,
  phases: (engagementId: string) => ["engagement", engagementId, "phases"] as const,
  lineItems: (engagementId: string) => ["engagement", engagementId, "line-items"] as const,
}
