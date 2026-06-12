-- Stored signals from daily deep news research (team + player keywords, 24h window).

create table public.news_research_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  nations_scanned int not null default 0,
  signals_found int not null default 0,
  signals_stored int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  note text
);

comment on table public.news_research_runs is 'Metadata for daily deep news research batches.';

alter table public.news_research_runs enable row level security;

create table public.team_news_signals (
  id text primary key,
  published_at timestamptz not null,
  detected_at timestamptz not null default now(),
  kind text not null,
  severity smallint not null check (severity between 1 and 3),
  confidence real not null check (confidence >= 0 and confidence <= 1),
  headline text not null,
  context text,
  detail text,
  source text not null,
  url text,
  team_codes text[] not null default '{}',
  players text[] not null default '{}',
  market_slugs text[] not null default '{}',
  price_impact jsonb,
  research_run_id uuid references public.news_research_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.team_news_signals is 'News, injuries, and lineup signals keyed by nation and player keywords.';

create index team_news_signals_published_at_idx on public.team_news_signals (published_at desc);
create index team_news_signals_team_codes_idx on public.team_news_signals using gin (team_codes);
create index team_news_signals_kind_idx on public.team_news_signals (kind);

create unique index team_news_signals_url_unique on public.team_news_signals (url) where url is not null;

alter table public.team_news_signals enable row level security;
