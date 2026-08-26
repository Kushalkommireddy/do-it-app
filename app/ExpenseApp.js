'use client';

import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../lib/supabaseClient';

const CATEGORY_COLORS = {
  Food: '#FF6B6B',
  Transport: '#4ECDC4',
  Shopping: '#FFB84C',
  Bills: '#6C5CE7',
  Entertainment: '#FF6FD8',
  Health: '#2ECC71',
  Other: '#74B9FF',
};
const CATEGORY_LIST = Object.keys(CATEGORY_COLORS);
const pad2 = (n) => String(n).padStart(2, '0');
const fmtMoney = (n) => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseApp({ session, theme, setTheme, onSignOut, onSwitchApp }) {
  const [expenses, setExpenses] = useState([]);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [allTime, setAllTime] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (!error && data) setExpenses(data);
  }, []);
  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function addExpense(data) {
    const { data: row, error } = await supabase.from('expenses').insert({ ...data, user_id: session.user.id }).select().single();
    if (!error && row) setExpenses((e) => [row, ...e]);
  }
  async function updateExpense(id, patch) {
    const { data: row, error } = await supabase.from('expenses').update(patch).eq('id', id).select().single();
    if (!error && row) setExpenses((e) => e.map((x) => (x.id === id ? row : x)));
  }
  async function deleteExpense(id) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) setExpenses((e) => e.filter((x) => x.id !== id));
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const inPeriod = (e) => {
    if (allTime) return true;
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  };
  const periodExpenses = expenses.filter(inPeriod);
  const filtered = categoryFilter ? periodExpenses.filter((e) => e.category === categoryFilter) : periodExpenses;
  const total = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const count = periodExpenses.length;
  const avg = count ? total / count : 0;

  const byCategory = {};
  periodExpenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));
  const topCategory = pieData.slice().sort((a, b) => b.value - a.value)[0];

  return (
    <div className="screen" id="expenseScreen">
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <div className="topbar-left">
            <button className="app-switch-btn" onClick={onSwitchApp}>← All apps</button>
            <div className="brand-mark" style={{ marginBottom: 0 }}>
              <div className="brand-square" style={{ background: 'linear-gradient(135deg,#FF6B6B,#FFB84C)' }}>
                <svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              </div>
              <div className="wordmark">Expense Tracker</div>
            </div>
          </div>
          <div className="topbar-right">
            <span className="user-chip">{session.user.email}</span>
            <select className="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="aurora">Aurora</option>
              <option value="hero">Hero Squad</option>
            </select>
            <button className="icon-btn" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <div className="expense-main">
          <div className="month-nav">
            {!allTime && (
              <>
                <button className="cal-nav-btn" onClick={() => { let m = viewMonth - 1, y = viewYear; if (m < 0) { m = 11; y--; } setViewMonth(m); setViewYear(y); }}>‹</button>
                <span className="month-label">{monthNames[viewMonth]} {viewYear}</span>
                <button className="cal-nav-btn" onClick={() => { let m = viewMonth + 1, y = viewYear; if (m > 11) { m = 0; y++; } setViewMonth(m); setViewYear(y); }}>›</button>
              </>
            )}
            <button className="link-btn" style={{ marginLeft: allTime ? 0 : 12 }} onClick={() => setAllTime((v) => !v)}>
              {allTime ? 'Show by month' : 'View all time'}
            </button>
            <button className="new-btn" style={{ marginLeft: 'auto' }} onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>+ Add expense</button>
          </div>

          <div className="stat-row">
            <div className="stat-card"><div className="stat-label">Total spent</div><div className="stat-value accent-coral">{fmtMoney(total)}</div></div>
            <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value accent-teal">{count}</div></div>
            <div className="stat-card"><div className="stat-label">Average</div><div className="stat-value accent-gold">{fmtMoney(avg)}</div></div>
            <div className="stat-card">
              <div className="stat-label">Top category</div>
              <div className="stat-value" style={{ color: topCategory ? CATEGORY_COLORS[topCategory.name] : undefined, fontSize: 16 }}>
                {topCategory ? topCategory.name : '—'}
              </div>
            </div>
          </div>

          {showForm && (
            <ExpenseForm
              initial={{}}
              onCancel={() => setShowForm(false)}
              onSave={async (data) => { await addExpense(data); setShowForm(false); }}
            />
          )}

          <div className="exp-layout">
            <div className="exp-chart-card">
              <div className="side-label" style={{ marginBottom: 14 }}>Spending by category</div>
              {pieData.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 10px' }}>
                  <div className="em-title">No data yet</div>
                  <div className="em-sub">Add an expense to see the breakdown.</div>
                </div>
              ) : (
                <>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#999'} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => fmtMoney(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {pieData.sort((a, b) => b.value - a.value).map((d) => (
                      <div key={d.name} className="legend-row" style={{ cursor: 'pointer' }}
                        onClick={() => setCategoryFilter(categoryFilter === d.name ? '' : d.name)}>
                        <div className="legend-left">
                          <span className="legend-dot" style={{ background: CATEGORY_COLORS[d.name] }} />
                          <span style={{ fontWeight: categoryFilter === d.name ? 700 : 400, color: categoryFilter === d.name ? 'var(--text)' : undefined }}>{d.name}</span>
                        </div>
                        <span className="legend-amt">{fmtMoney(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="exp-list-col">
              {categoryFilter && (
                <div className="info-note">
                  <span>Filtering by <strong>{categoryFilter}</strong></span>
                  <button className="link-btn" onClick={() => setCategoryFilter('')}>Clear</button>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="empty-state"><div className="em-title">Nothing here yet</div><div className="em-sub">Add your first expense above.</div></div>
              ) : (
                filtered.map((e) =>
                  editingId === e.id ? (
                    <ExpenseForm key={e.id} initial={e} onCancel={() => setEditingId(null)}
                      onSave={async (data) => { await updateExpense(e.id, data); setEditingId(null); }} />
                  ) : (
                    <ExpenseRow key={e.id} exp={e} onEdit={() => { setEditingId(e.id); setShowForm(false); }} onDelete={() => deleteExpense(e.id)} />
                  )
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ initial, onSave, onCancel }) {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const [date, setDate] = useState(initial.date || defaultDate);
  const [category, setCategory] = useState(initial.category || CATEGORY_LIST[0]);
  const [entry, setEntry] = useState(initial.entry || '');
  const [amount, setAmount] = useState(initial.amount != null ? String(initial.amount) : '');

  return (
    <div className="exp-form">
      <div className="exp-form-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="exp-form-row">
        <input type="text" style={{ flex: 1 }} placeholder="What was it for?" value={entry} onChange={(e) => setEntry(e.target.value)} autoFocus />
        <input type="number" min="0" step="0.01" placeholder="Amount" style={{ width: 130 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="new-form-actions">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn-solid"
          onClick={() => {
            const amt = parseFloat(amount);
            if (!entry.trim() || isNaN(amt) || amt < 0 || !date) return;
            onSave({ date, category, entry: entry.trim(), amount: amt });
          }}
        >
          {initial.id ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </div>
  );
}

function ExpenseRow({ exp, onEdit, onDelete }) {
  const color = CATEGORY_COLORS[exp.category] || '#999';
  const d = new Date(exp.date + 'T00:00:00');
  return (
    <div className="expense-card">
      <div className="expense-cat-chip" style={{ background: color }}>{exp.category.slice(0, 2).toUpperCase()}</div>
      <div className="expense-info">
        <div className="expense-entry">{exp.entry}</div>
        <div className="expense-meta">{exp.category} · {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <div className="expense-amount" style={{ color }}>{fmtMoney(exp.amount)}</div>
      <div className="expense-actions">
        <button className="mini-btn" onClick={onEdit}>Edit</button>
        <button className="mini-btn danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
