const API = ''; // same origin as this admin page (this server serves both API and /admin)
const TOKEN_KEY = 'aidipto_admin_token';

const $ = (sel) => document.querySelector(sel);
const state = { page: 1, pageSize: 20, status: '', q: '', total: 0 };

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function api(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app-screen').classList.add('hidden');
}
function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app-screen').classList.remove('hidden');
}

// ---------- login ----------
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(data.token);
    await boot();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout-btn').addEventListener('click', () => {
  clearToken();
  showLogin();
});

// ---------- dashboard ----------
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadStats() {
  const stats = await api('/leads/stats');
  const byStatus = Object.fromEntries(stats.byStatus.map((s) => [s.status, s.count]));
  const cards = [
    { label: 'Total leads', value: stats.total },
    { label: 'New', value: byStatus.new || 0 },
    { label: 'Contacted', value: byStatus.contacted || 0 },
    { label: 'Qualified', value: byStatus.qualified || 0 },
    { label: 'Won', value: byStatus.won || 0 },
    { label: 'Lost', value: byStatus.lost || 0 },
  ];
  $('#stat-grid').innerHTML = cards
    .map((c) => `<div class="stat-card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
    .join('');
}

async function loadLeads() {
  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    ...(state.status ? { status: state.status } : {}),
    ...(state.q ? { q: state.q } : {}),
  });
  const data = await api(`/leads?${params.toString()}`);
  state.total = data.total;
  renderLeads(data.items);
  renderPager();
}

function badge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function renderLeads(items) {
  if (items.length === 0) {
    $('#leads-body').innerHTML = `<tr><td colspan="7" class="sub">No leads match this filter yet.</td></tr>`;
    return;
  }
  $('#leads-body').innerHTML = items
    .map(
      (l) => `
      <tr data-id="${l.id}">
        <td class="sub">${fmtDate(l.created_at)}</td>
        <td class="name-cell">${escapeHtml(l.name || '—')}<div class="sub">${escapeHtml(l.company || '')}</div></td>
        <td>${escapeHtml(l.email || '—')}<div class="sub">${escapeHtml(l.phone || '')}</div></td>
        <td>${escapeHtml(l.service || '—')}</td>
        <td class="sub">${escapeHtml(l.source || '—')}</td>
        <td>${badge(l.status)}</td>
        <td class="sub">View →</td>
      </tr>`,
    )
    .join('');

  $('#leads-body').querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => openDrawer(Number(tr.dataset.id), items.find((i) => i.id === Number(tr.dataset.id))));
  });
}

function renderPager() {
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  $('#pager').innerHTML = `
    <button id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>Prev</button>
    <span class="sub" style="align-self:center;">Page ${state.page} of ${pages}</span>
    <button id="next-page" ${state.page >= pages ? 'disabled' : ''}>Next</button>
  `;
  $('#prev-page').addEventListener('click', () => { state.page -= 1; loadLeads(); });
  $('#next-page').addEventListener('click', () => { state.page += 1; loadLeads(); });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- drawer ----------
function openDrawer(id, lead) {
  $('#drawer').classList.remove('hidden');
  $('#drawer-content').innerHTML = `
    <h2 style="margin:0 0 4px;">${escapeHtml(lead.name || 'Lead')}</h2>
    <p class="sub">${fmtDate(lead.created_at)} · ${escapeHtml(lead.source || 'website')}</p>

    ${row('Email', lead.email)}
    ${row('Phone / WhatsApp', lead.phone)}
    ${row('Company', lead.company)}
    ${row('Website', lead.website)}
    ${row('Business type', lead.business_type)}
    ${row('Service', lead.service)}
    ${row('Budget', lead.budget)}
    ${row('Timeline', lead.timeline)}
    ${row('Requirement', lead.requirement)}
    ${lead.conversation_summary ? row('Conversation summary', lead.conversation_summary) : ''}

    <div class="field-row">
      <div class="k">Status</div>
      <select id="drawer-status">
        ${['new', 'contacted', 'qualified', 'won', 'lost']
          .map((s) => `<option value="${s}" ${s === lead.status ? 'selected' : ''}>${s}</option>`)
          .join('')}
      </select>
    </div>
    <div class="field-row">
      <div class="k">Notes</div>
      <textarea id="drawer-notes" placeholder="Internal notes...">${escapeHtml(lead.notes || '')}</textarea>
    </div>

    <div class="drawer-actions">
      <button id="drawer-save" class="btn-primary">Save</button>
      <button id="drawer-delete" class="btn-danger">Delete lead</button>
    </div>
  `;

  $('#drawer-save').addEventListener('click', async () => {
    await api(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('#drawer-status').value, notes: $('#drawer-notes').value }),
    });
    closeDrawer();
    loadLeads();
    loadStats();
  });

  $('#drawer-delete').addEventListener('click', async () => {
    if (!confirm('Delete this lead permanently?')) return;
    await api(`/leads/${id}`, { method: 'DELETE' });
    closeDrawer();
    loadLeads();
    loadStats();
  });
}

function row(label, value) {
  return `<div class="field-row"><div class="k">${label}</div><div class="v">${escapeHtml(value || '—')}</div></div>`;
}

function closeDrawer() { $('#drawer').classList.add('hidden'); }
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') closeDrawer(); });

// ---------- filters ----------
let searchTimer;
$('#search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value;
    state.page = 1;
    loadLeads();
  }, 300);
});
$('#status-filter').addEventListener('change', (e) => {
  state.status = e.target.value;
  state.page = 1;
  loadLeads();
});

function updateExportLink() {
  $('#export-link').href = `${API}/api/leads/export.csv`;
  $('#export-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/leads/export.csv`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aidipto-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---------- boot ----------
async function boot() {
  try {
    const me = await api('/auth/me');
    $('#admin-email').textContent = me.email;
    showApp();
    updateExportLink();
    await Promise.all([loadStats(), loadLeads()]);
  } catch {
    showLogin();
  }
}

if (getToken()) boot();
else showLogin();
