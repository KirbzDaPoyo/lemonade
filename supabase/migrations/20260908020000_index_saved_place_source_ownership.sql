begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists saved_place_sources_owned_place_idx
  on public.saved_place_sources (saved_place_id, user_id);

commit;

notify pgrst, 'reload schema';
