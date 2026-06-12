-- Allow the terminal API to read stored news with the publishable (anon) key
-- when SUPABASE_SERVICE_ROLE_KEY is not set on Vercel.

create policy "team_news_signals_public_read"
  on public.team_news_signals
  for select
  to anon, authenticated
  using (true);
