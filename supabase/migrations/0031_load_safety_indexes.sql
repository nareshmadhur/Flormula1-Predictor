-- Package 1 load-safety indexes.
-- These support existing filters/orderings and do not change application data.

create index if not exists races_prediction_lock_open_idx
on public.races (prediction_lock_at)
where status <> 'cancelled';

create index if not exists user_race_scores_race_rank_idx
on public.user_race_scores (
  race_id,
  total_points desc,
  exact_hits desc,
  podium_points desc,
  bonus_points desc,
  user_id
);

create index if not exists bonus_options_question_order_idx
on public.bonus_options (bonus_question_id, display_order);

create index if not exists notification_events_user_race_type_status_idx
on public.notification_events (user_id, race_id, event_type, status, created_at desc);

create index if not exists notification_events_created_at_idx
on public.notification_events (created_at desc);
