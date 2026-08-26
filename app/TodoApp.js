'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const pad2 = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const priorityRank = (p) => ({ high: 0, medium: 1, low: 2 }[p] ?? 3);

function fmtDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  let label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff === 0) label = 'Today';
  else if (diff === 1) label = 'Tomorrow';
  else if (diff === -1) label = 'Yesterday';
  return { label, overdue: diff < 0 };
}

export default function TodoApp({ session, theme, setTheme, onSignOut, onSwitchApp }) {
  const [tasks, setTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('active');
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created-desc');
  const [selectedDate, setSelectedDate] = useState(null);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addingStepFor, setAddingStepFor] = useState(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (!error && data) setTasks(data);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function addTask(data) {
    const { data: row, error } = await supabase
      .from('tasks').insert({ ...data, user_id: session.user.id }).select().single();
    if (!error && row) setTasks((t) => [row, ...t]);
  }
  async function updateTask(id, patch) {
    const { data: row, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
    if (!error && row) setTasks((t) => t.map((x) => (x.id === id ? row : x)));
  }
  async function purgeTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks((t) => t.filter((x) => x.id !== id));
  }

  const categories = [...new Set(tasks.filter((t) => !t.deleted && t.category).map((t) => t.category))].sort();
  const active = tasks.filter((t) => !t.deleted && !t.completed).length;
  const completed = tasks.filter((t) => !t.deleted && t.completed).length;
  const all = tasks.filter((t) => !t.deleted).length;
  const trash = tasks.filter((t) => t.deleted).length;
  const overdueCount = tasks.filter((t) => !t.deleted && !t.completed && t.due && t.due < todayStr()).length;
  const pct = all ? Math.round((completed / all) * 100) : 0;

  function getFiltered() {
    let list = tasks.slice();
    if (selectedDate) list = list.filter((t) => !t.deleted && t.due === selectedDate);
    else if (activeFilter === 'trash') list = list.filter((t) => t.deleted);
    else if (activeFilter === 'overdue') list = list.filter((t) => !t.deleted && !t.completed && t.due && t.due < todayStr());
    else {
      list = list.filter((t) => !t.deleted);
      if (activeFilter === 'active') list = list.filter((t) => !t.completed);
      else if (activeFilter === 'completed') list = list.filter((t) => t.completed);
    }
    if (activeCategory) list = list.filter((t) => t.category === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => (t.title + ' ' + (t.notes || '')).toLowerCase().includes(q));
    if (sort === 'created-desc') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'created-asc') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'due-asc') list.sort((a, b) => { if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1; return new Date(a.due) - new Date(b.due); });
    else if (sort === 'priority') list.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    return list;
  }

  const list = getFiltered();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const dueDates = new Set(tasks.filter((t) => !t.deleted && t.due).map((t) => t.due));
  const emptyMsgs = {
    active: ['Nothing on the list', 'Add an entry above to get started.'],
    overdue: ['Nothing overdue', "You're all caught up — nice work."],
    completed: ['Nothing completed yet', 'Checked-off entries will collect here.'],
    all: ['Nothing here yet', 'Add your first entry above.'],
    trash: ['Trash is empty', 'Deleted entries will show up here.'],
  };
  let emptyTitle, emptySub;
  if (selectedDate) { emptyTitle = 'Nothing due that day'; emptySub = 'No entries are scheduled for this date.'; }
  else [emptyTitle, emptySub] = emptyMsgs[activeFilter] || emptyMsgs.all;

  return (
    <div className="screen" id="appScreen">
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <div className="topbar-left">
            <button className="app-switch-btn" onClick={onSwitchApp}>← All apps</button>
            <div className="brand-mark" style={{ marginBottom: 0 }}>
              <div className="brand-square"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
              <div className="wordmark">Do it!</div>
            </div>
            <span className="topbar-date">{now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
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

        <div className="app-body">
          <div className="sidebar">
            <div className="side-section">
              <div className="side-label">Views</div>
              {[
                ['active', 'Active', active],
                ['overdue', 'Overdue', overdueCount],
                ['completed', 'Completed', completed],
                ['all', 'All entries', all],
                ['trash', 'Trash', trash],
              ].map(([key, label, count]) => (
                <div key={key} className={'filter-item' + (!selectedDate && activeFilter === key ? ' active' : '')}
                  onClick={() => { setSelectedDate(null); setActiveFilter(key); }}>
                  <span>{label}</span><span className="count">{count}</span>
                </div>
              ))}
            </div>
            <div className="side-section">
              <div className="side-label">Categories</div>
              <div className={'cat-item' + (activeCategory === '' ? ' active' : '')} onClick={() => setActiveCategory('')}>All categories</div>
              {categories.map((c) => (
                <div key={c} className={'cat-item' + (activeCategory === c ? ' active' : '')} onClick={() => setActiveCategory(c)}>
                  <span className="cat-dot" />{c}
                </div>
              ))}
            </div>
            <div className="side-section">
              <div className="side-label">Progress</div>
              <div className="progress-track"><div className="progress-fill" style={{ width: pct + '%' }} /></div>
              <div className="progress-label">{completed} of {all} done</div>
            </div>
          </div>

          <div className="main">
            <div className="main-header">
              <input className="search-input" placeholder="Search entries…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="created-desc">Newest first</option>
                <option value="created-asc">Oldest first</option>
                <option value="due-asc">Due date</option>
                <option value="priority">Priority</option>
              </select>
              <button className="new-btn" onClick={() => { setShowNewForm((v) => !v); setEditingId(null); }}>+ New entry</button>
            </div>

            {showNewForm && (
              <TaskForm
                initial={selectedDate ? { due: selectedDate } : {}}
                onCancel={() => setShowNewForm(false)}
                onSave={async (data) => { await addTask({ ...data, subtasks: [], completed: false, deleted: false }); setShowNewForm(false); }}
              />
            )}

            {overdueCount > 0 && !selectedDate && activeFilter !== 'trash' && activeFilter !== 'overdue' && (
              <div className="info-note warn">
                <span>⚠ You have {overdueCount} {overdueCount === 1 ? 'entry' : 'entries'} overdue.</span>
                <button className="link-btn" onClick={() => { setSelectedDate(null); setActiveFilter('overdue'); }}>View overdue</button>
              </div>
            )}
            {selectedDate && (
              <div className="info-note">
                <span>Showing entries due <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong> (trash excluded)</span>
                <button className="link-btn" onClick={() => setSelectedDate(null)}>Clear</button>
              </div>
            )}
            {activeFilter === 'trash' && !selectedDate && (
              <div className="info-note"><span>Items in the trash are kept for reference. Restore them or clear them for good — nothing is auto-deleted.</span></div>
            )}

            {list.length === 0 ? (
              <div className="empty-state"><div className="em-title">{emptyTitle}</div><div className="em-sub">{emptySub}</div></div>
            ) : (
              list.map((t) =>
                editingId === t.id ? (
                  <TaskForm key={t.id} initial={t} onCancel={() => setEditingId(null)}
                    onSave={async (data) => { await updateTask(t.id, data); setEditingId(null); }} />
                ) : (
                  <TaskCard
                    key={t.id} task={t} addingStep={addingStepFor === t.id}
                    onToggle={() => updateTask(t.id, { completed: !t.completed })}
                    onEdit={() => { setEditingId(t.id); setShowNewForm(false); }}
                    onTrash={() => updateTask(t.id, { deleted: true })}
                    onRestore={() => updateTask(t.id, { deleted: false })}
                    onPurge={() => purgeTask(t.id)}
                    onAddStepClick={() => setAddingStepFor(t.id)}
                    onAddStep={(text) => updateTask(t.id, { subtasks: [...(t.subtasks || []), { id: Date.now().toString(), text, done: false }] })}
                    onToggleStep={(sid) => updateTask(t.id, { subtasks: t.subtasks.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) })}
                    onRemoveStep={(sid) => updateTask(t.id, { subtasks: t.subtasks.filter((s) => s.id !== sid) })}
                  />
                )
              )
            )}
          </div>

          <div className="calendar-sidebar">
            <div className="side-label">Calendar</div>
            <div className="cal-header">
              <button className="cal-nav-btn" onClick={() => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); }}>‹</button>
              <span className="cal-month-label">{monthNames[calMonth]} {calYear}</span>
              <button className="cal-nav-btn" onClick={() => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); }}>›</button>
            </div>
            <div className="cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
            <div className="cal-grid">
              {Array.from({ length: firstDay }).map((_, i) => <button key={'b' + i} className="cal-cell blank" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`;
                const isToday = dateStr === todayStr();
                const isSelected = dateStr === selectedDate;
                const hasTask = dueDates.has(dateStr);
                return (
                  <button key={dateStr} className={'cal-cell' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '')}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}>
                    {d}{hasTask && <span className="cal-dot" />}
                  </button>
                );
              })}
            </div>
            <div className="cal-hint">Click a date to see everything due that day. Dots mark days with entries.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial.title || '');
  const [notes, setNotes] = useState(initial.notes || '');
  const [priority, setPriority] = useState(initial.priority || 'medium');
  const [due, setDue] = useState(initial.due || '');
  const [category, setCategory] = useState(initial.category || '');

  return (
    <div className="new-form">
      <div className="new-form-row"><input type="text" style={{ flex: 1 }} placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="new-form-row"><textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="new-form-row">
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
        <input type="date" value={due || ''} onChange={(e) => setDue(e.target.value)} />
        <input type="text" style={{ width: 160 }} placeholder="Category (e.g. Work)" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="new-form-actions">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-solid" onClick={() => { if (!title.trim()) return; onSave({ title: title.trim(), notes: notes.trim(), priority, due: due || null, category: category.trim() }); }}>
          {initial.id ? 'Save changes' : 'Add entry'}
        </button>
      </div>
    </div>
  );
}

function TaskCard({ task: t, addingStep, onToggle, onEdit, onTrash, onRestore, onPurge, onAddStepClick, onAddStep, onToggleStep, onRemoveStep }) {
  const [stepText, setStepText] = useState('');
  const due = fmtDue(t.due);
  const isOverdue = !t.deleted && !t.completed && due && due.overdue;
  const subDone = (t.subtasks || []).filter((s) => s.done).length;

  return (
    <div className={'task-card' + (isOverdue ? ' overdue' : '')}>
      <div className={'task' + (t.completed ? ' completed' : '')}>
        {!t.deleted ? (
          <button className={'check' + (t.completed ? ' checked' : '')} onClick={onToggle}>
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
        ) : <span style={{ width: 22 }} />}
        <div className="task-main">
          <div className="task-title-row">
            <span className="task-title">{t.title}</span>
            <span className={'badge p-' + t.priority}>{t.priority}</span>
            {due && <span className={'badge due' + (due.overdue && !t.completed ? ' overdue' : '')}>{due.label}</span>}
            {t.category && <span className="badge cat">{t.category}</span>}
            {t.subtasks && t.subtasks.length > 0 && <span className="badge due">{subDone}/{t.subtasks.length} steps</span>}
          </div>
          {t.notes && <div className="task-notes">{t.notes}</div>}
          {!t.deleted && (
            <div className="subtasks">
              {(t.subtasks || []).map((s) => (
                <div key={s.id} className={'subtask-row' + (s.done ? ' done' : '')}>
                  <button className={'check' + (s.done ? ' checked' : '')} onClick={() => onToggleStep(s.id)}>
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                  <span>{s.text}</span>
                  <button className="mini-btn danger" style={{ marginLeft: 'auto', padding: '2px 6px' }} onClick={() => onRemoveStep(s.id)}>×</button>
                </div>
              ))}
              {addingStep && (
                <div className="subtask-add">
                  <input type="text" placeholder="Add a step…" value={stepText} autoFocus
                    onChange={(e) => setStepText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && stepText.trim()) { onAddStep(stepText.trim()); setStepText(''); } }} />
                  <button onClick={() => { if (stepText.trim()) { onAddStep(stepText.trim()); setStepText(''); } }}>Add</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="task-actions">
          {t.deleted ? (
            <>
              <button className="mini-btn accent" onClick={onRestore}>Restore</button>
              <button className="mini-btn danger" onClick={onPurge}>Delete forever</button>
            </>
          ) : (
            <>
              <button className="mini-btn" onClick={onEdit}>Edit</button>
              <button className="mini-btn" onClick={onAddStepClick}>+ step</button>
              <button className="mini-btn danger" onClick={onTrash}>Trash</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
