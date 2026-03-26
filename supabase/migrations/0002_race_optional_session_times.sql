alter table public.races
  add column fp1_at timestamp with time zone,
  add column fp2_at timestamp with time zone,
  add column fp3_at timestamp with time zone,
  add column quali_at timestamp with time zone,
  add column sprint_at timestamp with time zone,
  add column sprint_quali_at timestamp with time zone;
