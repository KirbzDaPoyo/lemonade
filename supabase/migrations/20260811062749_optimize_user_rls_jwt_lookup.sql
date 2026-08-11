alter policy "Users read their saved places"
on public.saved_places
using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users create their saved places"
on public.saved_places
with check (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users update their saved places"
on public.saved_places
using (((select auth.jwt()) ->> 'sub') = user_id)
with check (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users delete their saved places"
on public.saved_places
using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users read their place tags"
on public.place_tags
using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users create their place tags"
on public.place_tags
with check (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users update their place tags"
on public.place_tags
using (((select auth.jwt()) ->> 'sub') = user_id)
with check (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Users delete their place tags"
on public.place_tags
using (((select auth.jwt()) ->> 'sub') = user_id);
