import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { forwardLeadToN8n } from '../lib/n8n.js';

export const leadsRouter = Router();

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;
type Status = (typeof STATUSES)[number];

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

interface LeadInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  businessType?: string;
  service?: string;
  requirement?: string;
  budget?: string;
  timeline?: string;
  source?: string;
  conversationSummary?: string;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 4000) : '');

/** Public — the contact form and the Ask AIDIPTO assistant both submit leads here. */
leadsRouter.post('/lead', submitLimiter, (req, res) => {
  const body = req.body as LeadInput;
  const name = clean(body.name);
  const email = clean(body.email);
  const phone = clean(body.phone);

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const now = new Date().toISOString();
  const record = {
    created_at: now,
    updated_at: now,
    name,
    email,
    phone,
    company: clean(body.company),
    website: clean(body.website),
    business_type: clean(body.businessType),
    service: clean(body.service),
    requirement: clean(body.requirement),
    budget: clean(body.budget),
    timeline: clean(body.timeline),
    source: clean(body.source) || 'website',
    conversation_summary: clean(body.conversationSummary),
    status: 'new' as Status,
    notes: '',
  };

  const info = db
    .prepare(
      `INSERT INTO leads
        (created_at, updated_at, name, email, phone, company, website, business_type,
         service, requirement, budget, timeline, source, conversation_summary, status, notes)
       VALUES
        (@created_at, @updated_at, @name, @email, @phone, @company, @website, @business_type,
         @service, @requirement, @budget, @timeline, @source, @conversation_summary, @status, @notes)`,
    )
    .run(record);

  forwardLeadToN8n({ id: info.lastInsertRowid, ...record });

  res.status(201).json({ id: info.lastInsertRowid, delivered: true });
});

/** Admin — list leads with optional status filter and search. */
leadsRouter.get('/leads', requireAdmin, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (status && STATUSES.includes(status as Status)) {
    where.push('status = @status');
    params.status = status;
  }
  if (q) {
    where.push('(name LIKE @q OR email LIKE @q OR company LIKE @q OR requirement LIKE @q)');
    params.q = `%${q}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM leads ${whereSql}`).get(params) as { c: number }).c;
  const items = db
    .prepare(
      `SELECT * FROM leads ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  res.json({ items, total, page, pageSize });
});

/** Admin — quick counts for the dashboard cards. */
leadsRouter.get('/leads/stats', requireAdmin, (_req, res) => {
  const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM leads GROUP BY status').all();
  const byService = db
    .prepare("SELECT COALESCE(NULLIF(service, ''), 'Not specified') AS service, COUNT(*) AS count FROM leads GROUP BY service ORDER BY count DESC")
    .all();
  const total = (db.prepare('SELECT COUNT(*) AS c FROM leads').get() as { c: number }).c;
  const last7Days = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
       FROM leads
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY day ORDER BY day ASC`,
    )
    .all();
  res.json({ total, byStatus, byService, last7Days });
});

leadsRouter.get('/leads/export.csv', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all() as Record<string, unknown>[];
  const headers = [
    'id', 'created_at', 'name', 'email', 'phone', 'company', 'website', 'business_type',
    'service', 'requirement', 'budget', 'timeline', 'source', 'status', 'notes',
  ];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="aidipto-leads.csv"');
  res.send(csv);
});

leadsRouter.patch('/leads/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Lead not found.' });

  db.prepare(
    `UPDATE leads SET
       status = COALESCE(@status, status),
       notes = COALESCE(@notes, notes),
       updated_at = @updated_at
     WHERE id = @id`,
  ).run({ id, status: status ?? null, notes: notes ?? null, updated_at: new Date().toISOString() });

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.json(updated);
});

leadsRouter.delete('/leads/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Lead not found.' });
  res.status(204).end();
});
