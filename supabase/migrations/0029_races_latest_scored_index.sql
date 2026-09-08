create index if not exists races_season_status_start_desc_idx
on public.races (season, status, race_start_at desc);
