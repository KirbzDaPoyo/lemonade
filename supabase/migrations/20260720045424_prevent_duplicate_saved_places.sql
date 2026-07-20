-- Store one canonical URL for each Instagram post or reel so tracking
-- parameters and the /reels/ alias cannot bypass source-level deduplication.
update public.saved_places
set source_url = case
  when source_url ~* '^https?://(www\.)?instagram\.com/p/[^/?#]+'
    then regexp_replace(
      split_part(split_part(source_url, '?', 1), '#', 1),
      '^https?://(www\.)?instagram\.com/p/([^/]+)/*$',
      'https://www.instagram.com/p/\2/',
      'i'
    )
  when source_url ~* '^https?://(www\.)?instagram\.com/reels?/[^/?#]+'
    then regexp_replace(
      split_part(split_part(source_url, '?', 1), '#', 1),
      '^https?://(www\.)?instagram\.com/reels?/([^/]+)/*$',
      'https://www.instagram.com/reel/\2/',
      'i'
    )
  else source_url
end;

create unique index if not exists saved_places_source_url_unique_idx
  on public.saved_places (source_url);

create unique index if not exists saved_places_place_id_unique_idx
  on public.saved_places (place_id)
  where place_id is not null;
