begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.saved_places
  add column if not exists user_tags text[] not null default '{}';

comment on column public.saved_places.user_tags is
  'User-managed tags. New saves may only auto-assign values already present in this user tag vocabulary.';

comment on column public.saved_places.tags is
  'Legacy generated tags retained for data preservation. New clients read and write user_tags instead.';

commit;

notify pgrst, 'reload schema';
