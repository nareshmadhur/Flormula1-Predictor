alter table public.group_invites
add column if not exists share_token text;

create unique index if not exists group_invites_share_token_unique_idx
on public.group_invites (share_token)
where share_token is not null;

comment on column public.group_invites.share_token is
'Raw invite token retained so authorized group admins can re-copy active invite links. Older invite rows may be null because the first invite model stored only token hashes.';
