-- The product dropped the "lineup" (squad listings) and "fatigue" (schedule)
-- signal kinds — they added noise without market-moving information.
delete from public.team_news_signals where kind in ('lineup', 'fatigue');
