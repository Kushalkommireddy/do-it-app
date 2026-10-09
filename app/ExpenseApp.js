'use client';

import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../lib/supabaseClient';

const DEBIT_COLORS = {
  Food: '#FF6B6B',
  Transport: '#4ECDC4',
  Shopping: '#FFB84C',
  Bills: '#6C5CE7',
  Entertainment: '#FF6FD8',
  Health: '#2ECC71',
  Other: '#74B9FF',
};
const CREDIT_COLORS = {
  Salary: '#2ECC71',
  Freelance: '#00B894',
  Refund: '#4ECDC4',
  Gift: '#FF6FD8',
  Interest: '#FFB84C',
  'Other credit': '#74B9FF',
};
const CATEGORIES = { debit: Object.keys(DEBIT_COLORS), credit: Object.keys(CREDIT_COLORS) };
const colorFor = (cat) => DEBIT_COLORS[cat] || CREDIT_COLORS[cat] || '#999999';
const typeOf = (e) => (e.type === 'credit' ? 'credit' : 'debit');

const pad2 = (n) => String(n).padStart(2, '0');
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney = (n) => inr.format(Number(n));

export default function ExpenseApp({ session, theme, setTheme, onSignOut, onSwitchApp }) {
  const [expenses, setExpenses] = useState([]);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [allTime, setAllTime] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | debit | credit
  const [chartType, setChartType] = useState('debit'); // debit | credit
  const [error, setError] = useState('');

  const fetchExpenses = useCallback(async () => {
    const { data, error: err } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (err) setError(err.message);
    else if (data) setExpenses(data);
  }, []);
  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function addExpense(data) {
    setError('');
    const { data: row, error: err } = await supabase.from('expenses').insert({ ...data, user_id: session.user.id }).select().single();
    if (err) { setError(err.message); return false; }
    setExpenses((e) => [row, ...e]);
    return true;
  }
  async function updateExpense(id, patch) {
    setError('');
    const { data: row, error: err } = await supabase.from('expenses').update(patch).eq('id', id).select().single();
    if (err) { setError(err.message); return false; }
    setExpenses((e) => e.map((x) => (x.id === id ? row : x)));
    return true;
  }
  async function deleteExpense(id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setError('');
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) setError(err.message);
    else setExpenses((e) => e.filter((x) => x.id !== id));
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const inPeriod = (e) => {
    if (allTime) return true;
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  };
  const periodEntries = expenses.filter(inPeriod);
  const debits = periodEntries.filter((e) => typeOf(e) === 'debit');
  const credits = periodEntries.filter((e) => typeOf(e) === 'credit');
  const sum = (arr) => arr.reduce((s, e) => s + Number(e.amount), 0);
  const totalSpent = sum(debits);
  const totalCredit = sum(credits);
  const balance = totalCredit - totalSpent;

  const listBase = typeFilter === 'all' ? periodEntries : periodEntries.filter((e) => typeOf(e) === typeFilter);
  const filtered = categoryFilter ? listBase.filter((e) => e.category === categoryFilter) : listBase;

  const chartEntries = chartType === 'debit' ? debits : credits;
  const byCategory = {};
  chartEntries.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const topSpend = (() => {
    const m = {};
    debits.forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount); });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  })();

  return (
    <div className="screen" id="expenseScreen">
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <div className="topbar-left">
            <button className="app-switch-btn" onClick={onSwitchApp}>← All apps</button>
            <div className="brand-mark" style={{ marginBottom: 0 }}>
              <div className="brand-square" style={{ background: 'linear-gradient(135deg,#FF6B6B,#FFB84C)' }}>
                <svg viewBox="0 0 24 24"><path d="M6 4h12M6 9h12M9 4c4 0 6 2 6 5s-2 5-6 5l7 6" /></svg>
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
            <button className="new-btn" style={{ marginLeft: 'auto' }} onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>+ Add entry</button>
          </div>

          {error && (
            <div className="info-note warn">
              <span>Something went wrong: {error}</span>
              <button className="link-btn" onClick={() => setError('')}>Dismiss</button>
            </div>
          )}

          <div className="stat-row">
            <div className="stat-card"><div className="stat-label">Credited</div><div className="stat-value accent-green">{fmtMoney(totalCredit)}</div></div>
            <div className="stat-card"><div className="stat-label">Spent</div><div className="stat-value accent-coral">{fmtMoney(totalSpent)}</div></div>
            <div className="stat-card">
              <div className="stat-label">Balance</div>
              <div className="stat-value" style={{ color: balance < 0 ? '#FF6B6B' : '#2ECC71' }}>{fmtMoney(balance)}</div>
            </div>
            <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value accent-teal">{periodEntries.length}</div></div>
            <div className="stat-card">
              <div className="stat-label">Top spend</div>
              <div className="stat-value" style={{ color: topSpend ? colorFor(topSpend[0]) : undefined, fontSize: 16 }}>
                {topSpend ? topSpend[0] : '—'}
              </div>
            </div>
          </div>

          {showForm && (
            <EntryForm
              initial={{}}
              onCancel={() => setShowForm(false)}
              onSave={async (data) => { if (await addExpense(data)) setShowForm(false); }}
            />
          )}

          <div className="exp-layout">
            <div className="exp-chart-card">
              <div className="seg" style={{ marginBottom: 14 }}>
                <button className={chartType === 'debit' ? 'active' : ''} onClick={() => { setChartType('debit'); setCategoryFilter(''); }}>Spending</button>
                <button className={chartType === 'credit' ? 'active credit' : ''} onClick={() => { setChartType('credit'); setCategoryFilter(''); }}>Credits</button>
              </div>
              {pieData.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 10px' }}>
                  <div className="em-title">No data yet</div>
                  <div className="em-sub">{chartType === 'debit' ? 'Add an expense to see the breakdown.' : 'Add a credit to see where money came from.'}</div>
                </div>
              ) : (
                <>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={colorFor(entry.name)} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => fmtMoney(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {pieData.map((d) => (
                      <div key={d.name} className="legend-row" style={{ cursor: 'pointer' }}
                        onClick={() => { setTypeFilter(chartType); setCategoryFilter(categoryFilter === d.name ? '' : d.name); }}>
                        <div className="legend-left">
                          <span className="legend-dot" style={{ background: colorFor(d.name) }} />
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
              <div className="seg" style={{ marginBottom: 14 }}>
                <button className={typeFilter === 'all' ? 'active' : ''} onClick={() => { setTypeFilter('all'); setCategoryFilter(''); }}>All</button>
                <button className={typeFilter === 'debit' ? 'active' : ''} onClick={() => { setTypeFilter('debit'); setCategoryFilter(''); }}>Expenses</button>
                <button className={typeFilter === 'credit' ? 'active credit' : ''} onClick={() => { setTypeFilter('credit'); setCategoryFilter(''); }}>Credits</button>
              </div>
              {categoryFilter && (
                <div className="info-note">
                  <span>Filtering by <strong>{categoryFilter}</strong></span>
                  <button className="link-btn" onClick={() => setCategoryFilter('')}>Clear</button>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="empty-state"><div className="em-title">Nothing here yet</div><div className="em-sub">Add your first entry above.</div></div>
              ) : (
                filtered.map((e) =>
                  editingId === e.id ? (
                    <EntryForm key={e.id} initial={e} onCancel={() => setEditingId(null)}
                      onSave={async (data) => { if (await updateExpense(e.id, data)) setEditingId(null); }} />
                  ) : (
                    <EntryRow key={e.id} exp={e} onEdit={() => { setEditingId(e.id); setShowForm(false); }} onDelete={() => deleteExpense(e.id)} />
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

function EntryForm({ initial, onSave, onCancel }) {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const [type, setType] = useState(initial.type === 'credit' ? 'credit' : 'debit');
  const [date, setDate] = useState(initial.date || defaultDate);
  const [category, setCategory] = useState(initial.category || CATEGORIES[initial.type === 'credit' ? 'credit' : 'debit'][0]);
  const [entry, setEntry] = useState(initial.entry || '');
  const [amount, setAmount] = useState(initial.amount != null ? String(initial.amount) : '');

  function switchType(t) {
    setType(t);
    if (!CATEGORIES[t].includes(category)) setCategory(CATEGORIES[t][0]);
  }

  return (
    <div className="exp-form">
      <div className="exp-form-row">
        <div className="seg">
          <button type="button" className={type === 'debit' ? 'active' : ''} onClick={() => switchType('debit')}>Expense</button>
          <button type="button" className={type === 'credit' ? 'active credit' : ''} onClick={() => switchType('credit')}>Credit</button>
        </div>
      </div>
      <div className="exp-form-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES[type].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="exp-form-row">
        <input type="text" style={{ flex: 1 }} placeholder={type === 'credit' ? 'Where did it come from?' : 'What was it for?'} value={entry} onChange={(e) => setEntry(e.target.value)} autoFocus />
        <input type="number" min="0" step="0.01" placeholder="Amount (₹)" style={{ width: 140 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="new-form-actions">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn-solid"
          onClick={() => {
            const amt = parseFloat(amount);
            if (!entry.trim() || isNaN(amt) || amt < 0 || !date) return;
            onSave({ date, category, entry: entry.trim(), amount: amt, type });
          }}
        >
          {initial.id ? 'Save changes' : type === 'credit' ? 'Add credit' : 'Add expense'}
        </button>
      </div>
    </div>
  );
}

function EntryRow({ exp, onEdit, onDelete }) {
  const isCredit = typeOf(exp) === 'credit';
  const color = colorFor(exp.category);
  const d = new Date(exp.date + 'T00:00:00');
  return (
    <div className="expense-card">
      <div className="expense-cat-chip" style={{ background: color }}>{exp.category.slice(0, 2).toUpperCase()}</div>
      <div className="expense-info">
        <div className="expense-entry">{exp.entry}</div>
        <div className="expense-meta">
          {isCredit && <span style={{ color: '#2ECC71', fontWeight: 700 }}>Credit · </span>}
          {exp.category} · {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div className="expense-amount" style={{ color: isCredit ? '#2ECC71' : color }}>
        {isCredit ? '+ ' : '− '}{fmtMoney(exp.amount)}
      </div>
      <div className="expense-actions">
        <button className="mini-btn" onClick={onEdit}>Edit</button>
        <button className="mini-btn danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
