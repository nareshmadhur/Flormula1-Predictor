drop trigger if exists audit_bonus_option_change on public.bonus_options;
drop trigger if exists audit_bonus_question_change on public.bonus_questions;

drop function if exists public.audit_bonus_option_change();
drop function if exists public.audit_bonus_question_change();

drop table if exists public.bonus_question_audit;
