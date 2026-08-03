begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.saved_places
  add column if not exists is_favorite boolean not null default false;

-- Preserve the only preference information available before changing lifecycle status.
update public.saved_places
set is_favorite = true
where status = 'favorite';

alter table public.saved_places
  drop constraint if exists saved_places_status_check;

-- The legacy model discarded a favorite place's earlier lifecycle status. Assign the
-- non-destructive default and retain Favorite independently rather than inventing history.
update public.saved_places
set status = case
  when status = 'favorite' then 'want_to_go'
  when status = 'skip' then 'skipped'
  else status
end
where status in ('favorite', 'skip');

alter table public.saved_places
  add constraint saved_places_status_check
  check (status in ('want_to_go', 'visited', 'skipped'));

comment on column public.saved_places.is_favorite is
  'Independent preference flag. Legacy favorites retain Favorite here and use want_to_go because their earlier lifecycle was not stored.';

commit;
