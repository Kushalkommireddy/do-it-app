-- Run this once in Supabase → SQL Editor → New query → Run.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  notes text default '',
  priority text default 'medium' check (priority in ('low','medium','high')),
  due date,
  category text default '',
  subtasks jsonb default '[]'::jsonb,
  completed boolean default false,
  deleted boolean default false,
  created_at timestamptz default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);

-- Row Level Security: this is what actually keeps User A from ever
-- being able to read or write User B's rows, enforced by Postgres
-- itself, not just hidden in the app's UI.
alter table public.tasks enable row level security;

drop policy if exists "Users can manage their own tasks" on public.tasks;
create policy "Users can manage their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================= Expense Tracker =================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  category text not null default 'Other',
  entry text not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz default now()
);

-- 'debit' = money spent, 'credit' = money received. Safe to re-run, and adds
-- the column to a table that was created before this existed.
alter table public.expenses
  add column if not exists type text not null default 'debit'
  check (type in ('debit','credit'));

create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_date_idx on public.expenses(date);

alter table public.expenses enable row level security;

drop policy if exists "Users can manage their own expenses" on public.expenses;
create policy "Users can manage their own expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
