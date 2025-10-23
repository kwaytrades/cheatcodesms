export const AGENT_EXPIRATION_DAYS: Record<string, number> = {
  customer_service: 36500, // ~100 years (indefinite)
  sales_agent: 90,
  textbook: 90,
  flashcards: 60,
  webinar: 30,
  algo_monthly: 90,
  ccta: 90,
  lead_nurture: 90,
};

export function getAgentExpirationDate(agentType: string): string {
  const days = AGENT_EXPIRATION_DAYS[agentType] || 90;
  const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expirationDate.toISOString();
}

export function formatDaysRemaining(expirationDate: string, agentType: string): string {
  if (agentType === 'customer_service') {
    return '∞';
  }
  
  const days = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days > 0 ? `${days}` : '0';
}
