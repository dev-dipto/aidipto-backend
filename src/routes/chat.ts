import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { answerLocally } from '../lib/knowledge.js';
import { askOpenAI } from '../lib/openai.js';
import { requireAdmin } from '../middleware/auth.js';

export const chatRouter = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Slow down a little.' },
});

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const logMessage = (sessionId: string, role: 'user' | 'assistant', content: string) => {
  db.prepare('INSERT INTO chat_logs (created_at, session_id, role, content) VALUES (?, ?, ?, ?)').run(
    new Date().toISOString(),
    sessionId,
    role,
    content,
  );
};

/**
 * Public chat endpoint. Uses OpenAI when OPENAI_API_KEY is configured, and the
 * same local knowledge-base matcher the frontend ships with otherwise (or if
 * the OpenAI call fails for any reason).
 */
chatRouter.post('/chat', chatLimiter, async (req, res) => {
  const { message, history, sessionId } = req.body as {
    message?: string;
    history?: HistoryItem[];
    sessionId?: string;
  };

  const text = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
  if (!text) return res.status(400).json({ error: 'Message is required.' });

  const sid = typeof sessionId === 'string' && sessionId ? sessionId.slice(0, 100) : 'anonymous';
  const safeHistory = Array.isArray(history)
    ? history
        .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-8)
    : [];

  logMessage(sid, 'user', text);

  const aiReply = await askOpenAI(text, safeHistory);
  const reply = aiReply ? { text: aiReply, suggestions: undefined } : answerLocally(text);

  logMessage(sid, 'assistant', reply.text);

  res.json({ reply: reply.text, suggestions: reply.suggestions ?? [], source: aiReply ? 'openai' : 'knowledge-base' });
});

/** Admin — read back a conversation by session id, e.g. from a lead's conversationSummary. */
chatRouter.get('/chat-logs/:sessionId', requireAdmin, (req, res) => {
  const rows = db
    .prepare('SELECT role, content, created_at FROM chat_logs WHERE session_id = ? ORDER BY created_at ASC')
    .all(req.params.sessionId);
  res.json({ items: rows });
});
