begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.saved_places
  add column if not exists user_category_override text,
  add column if not exists filter_overrides jsonb not null default '{}'::jsonb;

alter table public.saved_places
  drop constraint if exists saved_places_user_category_override_check,
  drop constraint if exists saved_places_filter_overrides_object_check;

alter table public.saved_places
  add constraint saved_places_user_category_override_check
    check (
      user_category_override is null or
      user_category_override in ('cafe', 'restaurant', 'street_food', 'dessert', 'bar', 'market', 'other')
    ),
  add constraint saved_places_filter_overrides_object_check
    check (jsonb_typeof(filter_overrides) = 'object');

comment on column public.saved_places.user_category_override is
  'Optional user-selected primary category. Generated category remains unchanged.';

comment on column public.saved_places.filter_overrides is
  'Sparse fixed-filter membership overrides. Boolean values take precedence over automatic category matching.';

commit;

notify pgrst, 'reload schema';
