-- Tournament-wide news: signals with no team tag but clear World Cup relevance
-- link to every market instead of being dropped or misattributed to a nation.

alter table public.team_news_signals
  add column if not exists is_global boolean not null default false;

comment on column public.team_news_signals.is_global is
  'Tournament-wide signal (no specific team) — shown on every World Cup market.';
