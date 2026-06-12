-- Bilingual LLM digestion (en + es) matching app locale.

alter table public.team_news_signals
  add column if not exists context_en text,
  add column if not exists context_es text;

update public.team_news_signals
set context_es = context
where context is not null and context_es is null;

comment on column public.team_news_signals.context_en is 'LLM market-impact summary (English).';

comment on column public.team_news_signals.context_es is 'LLM market-impact summary (Spanish).';
