BEGIN;

-- Backfill itineraryData.days[].items[].imageUrl for existing rows.
-- Priority:
-- 1) If photoReference exists, force imageUrl to Google photo proxy path.
-- 2) Keep stable existing imageUrl only when there is no photoReference.
-- 3) Remove missing/unstable source.unsplash.com imageUrl.
UPDATE public.itineraries AS it
SET itinerarydata = patched.patched_text
FROM (
  SELECT
    i.uuid,
    jsonb_set(root.data, '{days}', normalized.days_json, true)::text AS patched_text
  FROM public.itineraries AS i
  CROSS JOIN LATERAL (
    SELECT i.itinerarydata::jsonb AS data
  ) AS root
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN jsonb_typeof(day_obj->'items') = 'array' THEN
            jsonb_set(
              day_obj,
              '{items}',
              (
                SELECT COALESCE(
                  jsonb_agg(
                    CASE
                      WHEN NULLIF(BTRIM(COALESCE(item_obj->>'photoReference', '')), '') IS NOT NULL THEN
                        item_obj || jsonb_build_object(
                          'imageUrl',
                          '/api/places/photo?ref=' || (item_obj->>'photoReference') || '&maxwidth=400'
                        )
                      WHEN NULLIF(BTRIM(COALESCE(item_obj->>'imageUrl', '')), '') IS NOT NULL
                           AND LOWER(COALESCE(item_obj->>'imageUrl', '')) NOT LIKE '%source.unsplash.com%'
                        THEN item_obj
                      ELSE item_obj - 'imageUrl'
                    END
                  ),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(day_obj->'items') AS item_obj
              ),
              true
            )
          ELSE day_obj
        END
      ),
      '[]'::jsonb
    ) AS days_json
    FROM jsonb_array_elements(COALESCE(root.data->'days', '[]'::jsonb)) AS day_obj
  ) AS normalized
  WHERE i.itinerarydata IS NOT NULL
) AS patched
WHERE it.uuid = patched.uuid
  AND it.itinerarydata IS NOT NULL;

COMMIT;
