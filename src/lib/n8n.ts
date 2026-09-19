import { env } from '../env.js';

/** Fire-and-forget forward of a lead to n8n, if a webhook URL is configured. Never blocks the API response. */
export function forwardLeadToN8n(payload: Record<string, unknown>) {
  if (!env.n8nWebhookUrl) return;
  fetch(env.n8nWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.error('n8n webhook forward failed', err));
}
