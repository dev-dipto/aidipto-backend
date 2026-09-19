import { env } from '../env.js';
import { SYSTEM_PROMPT } from './knowledge.js';

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Calls OpenAI's chat completions endpoint, grounded in the AIDIPTO system prompt.
 * Only used when OPENAI_API_KEY is set — the key lives on this server and is
 * never sent to the frontend.
 */
export async function askOpenAI(message: string, history: HistoryItem[]): Promise<string | null> {
  if (!env.openaiApiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.4,
        max_tokens: 350,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.slice(-8),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!res.ok) {
      console.error('OpenAI request failed', res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('OpenAI request error', err);
    return null;
  }
}
