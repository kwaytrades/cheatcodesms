export const AGENT_EXPIRATION_DAYS: Record<string, number> = {
  customer_service: 36500, // ~100 years (indefinite)
  sales_agent: 90,
  textbook: 90,
  flashcards: 60,
  webinar: 30,
  algo_monthly: 90,
  ccta: 90,
  lead_nurture: 90,
  influencer_outreach: 90,
};

export function getAgentExpirationDate(agentType: string): string {
  const days = AGENT_EXPIRATION_DAYS[agentType] || 90;
  const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expirationDate.toISOString();
}