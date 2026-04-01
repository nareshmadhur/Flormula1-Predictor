drop policy if exists "Allow public read on scored prediction bonus answers" on public.prediction_bonus_answers;
create policy "Allow public read on scored prediction bonus answers"
on public.prediction_bonus_answers
for select
using (
  exists (
    select 1
    from public.predictions
    join public.races on races.id = predictions.race_id
    where predictions.id = prediction_bonus_answers.prediction_id
      and races.status = 'scored'
  )
);
