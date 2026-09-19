/**
 * Mirrors frontend/src/data/knowledge.ts and lib/assistant.ts so the backend
 * chat gives the same answers as the local fallback in the browser.
 * If you edit the wording on the site, copy the same edit here.
 */

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: string;
  followUps?: string[];
}

export const knowledge: KnowledgeEntry[] = [
  {
    id: 'services',
    keywords: ['service', 'offer', 'do you', 'what do you do', 'help with'],
    answer:
      'Five things: AI Automation, Digital Marketing, Web Design, WordPress and Shopify. Everything else — SEO, CRM setup, chatbots — sits inside one of those five.',
    followUps: ['Tell me about AI Automation', 'What does a web design project include?'],
  },
  {
    id: 'ai-automation',
    keywords: ['automation', 'automate', 'workflow', 'n8n', 'make', 'zapier', 'crm'],
    answer:
      'Automation work starts from the path an enquiry or order already takes, then removes the manual copying between steps. Typical stack: n8n, Make or Zapier, plus a language model where classification is needed.',
    followUps: ['Can you connect my existing CRM?', 'How long does a workflow take to build?'],
  },
  {
    id: 'marketing',
    keywords: ['marketing', 'seo', 'ads', 'facebook', 'campaign', 'traffic'],
    answer:
      'Marketing work covers site and funnel analysis, search structure, paid campaign setup and the reporting layer that ties them together.',
    followUps: ['What does SEO work include?', 'Do you run ad campaigns?'],
  },
  {
    id: 'web',
    keywords: ['web design', 'website', 'design', 'ui', 'ux', 'landing'],
    answer:
      'Sites are built as components in React or as themes in WordPress or Shopify, depending on who maintains the content afterwards.',
    followUps: ['Can you redesign an existing site?', 'Do you build in WordPress?'],
  },
  {
    id: 'wordpress',
    keywords: ['wordpress', 'wp', 'elementor', 'plugin'],
    answer:
      'WordPress work covers theme and template development, form handling, performance review and the automation hooks that move a submission into a CRM.',
  },
  {
    id: 'shopify',
    keywords: ['shopify', 'store', 'ecommerce', 'e-commerce', 'product', 'order'],
    answer:
      'Shopify work covers storefront build, product structure, checkout review and connecting order events to customer data, email and reporting.',
  },
  {
    id: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'budget', 'how much', 'rate'],
    answer:
      'Pricing depends on scope, so there is no fixed list here. Share the budget range and requirement and you will get a written scope with a figure attached rather than a guess.',
    followUps: ['I want to share my project details'],
  },
  {
    id: 'timeline',
    keywords: ['timeline', 'how long', 'deadline', 'urgent', 'delivery'],
    answer:
      'A single workflow is a short piece of work. A site plus connected operations is longer. Once the scope is written you get a schedule with it.',
  },
  {
    id: 'contact',
    keywords: ['contact', 'call', 'whatsapp', 'phone', 'email', 'talk', 'human'],
    answer:
      'Direct routes: info@aidipto.com, or +8801898880952 on WhatsApp. The contact form on this page prepares the same request.',
  },
  {
    id: 'process',
    keywords: ['process', 'how do you work', 'steps', 'start'],
    answer:
      'Four stages: a written scope, a build, a review against the scope, then handover with documentation. You see the working version before handover, not after.',
  },
  {
    id: 'data',
    keywords: ['demo data', 'real', 'fake', 'client', 'case study', 'result'],
    answer:
      'Every number, store and dashboard on this site is demo data, marked as such. No client names, revenue figures or results are published here.',
  },
];

export const fallbackAnswer =
  'That one is better answered directly rather than guessed at. Send it through the contact form or to info@aidipto.com and you will get a specific reply.';

/** Local keyword matcher — used when OPENAI_API_KEY is not set, and as a safety net if the OpenAI call fails. */
export function answerLocally(question: string): { text: string; suggestions?: string[] } {
  const normalised = question.toLowerCase();
  let best: { score: number; entry: KnowledgeEntry } | null = null;

  for (const entry of knowledge) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalised.includes(keyword)) score += keyword.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { score, entry };
  }

  if (!best) return { text: fallbackAnswer };
  return { text: best.entry.answer, suggestions: best.entry.followUps };
}

export const SYSTEM_PROMPT = `You are the AIDIPTO AI assistant, embedded on the AIDIPTO website.
AIDIPTO is an AI automation and digital growth company. It has exactly five main services:
AI Automation, Digital Marketing, Web Design, WordPress, Shopify. Everything else (n8n, SEO,
CRM setup, chatbots, ads, analytics, API integration) is a supporting capability inside one of
those five — never present it as a separate main service.

Contact: info@aidipto.com, WhatsApp +8801898880952, www.aidipto.com.

Rules you always follow:
- Never invent prices. If asked about cost, explain that pricing depends on scope and offer to
  collect project details instead of naming a figure.
- Never invent clients, case studies, results, statistics, partnerships or certifications.
  Every number, store or dashboard shown on the site is demo data.
- Keep answers concise (2-5 sentences) and practical. Answer the question first, then optionally
  ask one relevant follow-up question.
- If you don't have confirmed information about something, say so plainly and suggest contacting
  AIDIPTO directly rather than guessing.`;
