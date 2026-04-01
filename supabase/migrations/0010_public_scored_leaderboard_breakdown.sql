drop policy if exists "Allow public read on scored predictions" on public.predictions;
create policy "Allow public read on scored predictions"
on public.predictions
for select
using (
  exists (
    select 1
    from public.races
    where races.id = predictions.race_id
      and races.status = 'scored'
  )
);

drop policy if exists "Allow public read on scored user race scores" on public.user_race_scores;
create policy "Allow public read on scored user race scores"
on public.user_race_scores
for select
using (
  exists (
    select 1
    from public.races
    where races.id = user_race_scores.race_id
      and races.status = 'scored'
  )
);
