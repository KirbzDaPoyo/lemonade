create table if not exists public.saved_places (
  id text primary key,
  name text not null,
  address text not null,
  area_or_city text not null,
  category text not null check (
    category in ('cafe', 'restaurant', 'street_food', 'dessert', 'bar', 'market', 'other')
  ),
  cuisine_or_specialty text,
  tags text[] not null default '{}',
  notes text,
  source_url text not null,
  place_id text,
  map_url text,
  status text not null default 'want_to_go' check (
    status in ('want_to_go', 'visited', 'favorite', 'skip')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_places_created_at_idx
  on public.saved_places (created_at desc);

create index if not exists saved_places_status_idx
  on public.saved_places (status);

create or replace function public.set_saved_places_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_places_set_updated_at on public.saved_places;

create trigger saved_places_set_updated_at
before update on public.saved_places
for each row
execute function public.set_saved_places_updated_at();

alter table public.saved_places enable row level security;

drop policy if exists "MVP saved places read access" on public.saved_places;
drop policy if exists "MVP saved places insert access" on public.saved_places;
drop policy if exists "MVP saved places update access" on public.saved_places;
drop policy if exists "MVP saved places delete access" on public.saved_places;

create policy "MVP saved places read access"
on public.saved_places
for select
to anon
using (true);

create policy "MVP saved places insert access"
on public.saved_places
for insert
to anon
with check (true);

create policy "MVP saved places update access"
on public.saved_places
for update
to anon
using (true)
with check (true);

create policy "MVP saved places delete access"
on public.saved_places
for delete
to anon
using (true);
