-- ============================================================
-- Marketwake Deliverables Hub — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Clients ──────────────────────────────────────────────────
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  am_name       text not null default 'Marketwake',
  logo_url      text,
  -- client_token is the unguessable ID used in the public bookmarkable URL
  client_token  uuid unique not null default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Tasks ─────────────────────────────────────────────────────
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  -- section: which column the task lives in
  section       text not null default 'mw'
                  check (section in ('mw', 'client', 'done')),
  -- origin: where the task was originally created (for "un-move" logic)
  origin        text not null default 'mw'
                  check (origin in ('mw', 'client', 'done')),
  name          text not null default '',
  notes         text not null default '',
  status        text not null default 'Up Next',
  due_date      date,
  link_url      text not null default '',
  link_label    text not null default '',
  comments      text not null default '',
  display_order integer not null default 0,
  ai_drafted    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Drafts ────────────────────────────────────────────────────
-- AI-suggested tasks that are invisible until an AM approves them
create table public.drafts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  name           text not null default '',
  notes          text not null default '',
  status         text not null default 'Up Next',
  target_section text not null default 'mw'
                   check (target_section in ('mw', 'client')),
  drafted_at     timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index tasks_client_id_idx    on public.tasks(client_id);
create index tasks_section_order_idx on public.tasks(client_id, section, display_order);
create index drafts_client_id_idx   on public.drafts(client_id);
create index clients_token_idx      on public.clients(client_token);

-- ── updated_at trigger ────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ── Row Level Security ────────────────────────────────────────
-- Only authenticated users (AMs) can access any data.
-- The public client view uses the service role key on the server
-- side in a Next.js Server Component — it never touches Supabase
-- directly from the browser, so no public RLS rules are needed.

alter table public.clients enable row level security;
alter table public.tasks   enable row level security;
alter table public.drafts  enable row level security;

-- AMs (any authenticated user) have full access
create policy "AMs can manage clients"
  on public.clients for all
  to authenticated
  using (true) with check (true);

create policy "AMs can manage tasks"
  on public.tasks for all
  to authenticated
  using (true) with check (true);

create policy "AMs can manage drafts"
  on public.drafts for all
  to authenticated
  using (true) with check (true);
