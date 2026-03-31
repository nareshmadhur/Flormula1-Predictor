update public.races
set prediction_lock_at = fp1_at - interval '5 minutes'
where fp1_at is not null;
