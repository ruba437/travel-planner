-- Run this script once in your PostgreSQL database to enable homepage content tables.

CREATE TABLE IF NOT EXISTS public.trending_destinations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city character varying NOT NULL,
  country character varying,
  trip_count integer DEFAULT 0,
  score numeric(10,2) DEFAULT 0,
  cover_image text,
  is_active boolean DEFAULT true,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS trending_destinations_score_idx
  ON public.trending_destinations (score DESC, trip_count DESC, updatedat DESC);

CREATE TABLE IF NOT EXISTS public.travel_guides (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city character varying,
  country character varying,
  title character varying NOT NULL,
  summary text,
  body text,
  cover_image text,
  author_name character varying,
  author_username character varying,
  author_avatar text,
  slug character varying,
  guide_code character varying,
  trip_days integer,
  trip_nights integer,
  tags text[] DEFAULT '{}',
  view_count integer DEFAULT 0,
  is_published boolean DEFAULT true,
  publishedat timestamp without time zone,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS country character varying;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS author_username character varying;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS author_avatar text;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS slug character varying;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS guide_code character varying;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS trip_days integer;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS trip_nights integer;
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.travel_guides ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS travel_guides_published_idx
  ON public.travel_guides (is_published, publishedat DESC, updatedat DESC);
CREATE UNIQUE INDEX IF NOT EXISTS travel_guides_slug_uidx ON public.travel_guides(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS travel_guides_guide_code_uidx ON public.travel_guides(guide_code) WHERE guide_code IS NOT NULL;

-- CREATE TABLE IF NOT EXISTS public.travel_buddy_posts (
--   id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   user_id integer,
--   city character varying NOT NULL,
--   start_date date,
--   end_date date,
--   note text,
--   display_name character varying,
--   status character varying DEFAULT 'open',
--   createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT travel_buddy_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
-- );

-- CREATE INDEX IF NOT EXISTS travel_buddy_posts_status_idx
--   ON public.travel_buddy_posts (status, createdat DESC);

INSERT INTO public.trending_destinations (city, country, trip_count, score, is_active)
SELECT *
FROM (
  VALUES
    ('東京', '日本', 18, 90, true),
    ('大阪', '日本', 12, 86, true),
    ('首爾', '韓國', 10, 82, true),
    ('曼谷', '泰國', 9, 78, true),
    ('香港', '中國香港', 8, 76, true),
    ('新加坡', '新加坡', 7, 72, true)
) AS seed(city, country, trip_count, score, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.trending_destinations);

INSERT INTO public.travel_guides (city, country, title, summary, body, author_name, author_username, slug, guide_code, trip_days, trip_nights, tags, is_published, publishedat)
SELECT *
FROM (
  VALUES
    ('東京', '日本', '東京 4 天 3 夜節奏攻略', '以區域分日，搭配地鐵轉乘與雨天替代景點，適合第一次自由行。', '建議先鎖定住宿區域，再以地鐵線分日安排。', 'Travel Planner Team', 'travel-planner', '東京-4天3夜節奏攻略-TK01', 'TK01', 4, 3, ARRAY['都會', '自由行'], true, CURRENT_TIMESTAMP),
    ('大阪', '日本', '大阪美食與景點平衡路線', '白天景點、晚餐在地名店，並保留夜間彈性活動時段。', '以梅田、心齋橋、天王寺三區分流，降低折返。', 'Travel Planner Team', 'travel-planner', '大阪美食與景點平衡路線-OS02', 'OS02', 4, 3, ARRAY['美食', '城市散步'], true, CURRENT_TIMESTAMP),
    ('中國內蒙古自治區呼倫貝爾市', '中國', '中國內蒙古自治區呼倫貝爾市', '草原、濕地與邊境風景兼具，適合慢節奏自然旅行。', '建議以海拉爾為樞紐，安排莫日格勒河、額爾古納濕地與滿洲里邊境風景，並依天候保留彈性。', 'reanna.sun', 'reanna.sun', '中國內蒙古自治區呼倫貝爾市-ALQ8', 'ALQ8', 5, 4, ARRAY['草原', '自然風景', '慢旅行'], true, CURRENT_TIMESTAMP)
) AS seed(city, country, title, summary, body, author_name, author_username, slug, guide_code, trip_days, trip_nights, tags, is_published, publishedat)
WHERE NOT EXISTS (SELECT 1 FROM public.travel_guides);

-- INSERT INTO public.travel_buddy_posts (city, start_date, end_date, note, display_name, status)
-- SELECT *
-- FROM (
--   VALUES
--     ('台灣高雄市', CURRENT_DATE + 10, CURRENT_DATE + 12, '想找一起走市區散步與美食路線的旅伴。', '旅人 A', 'open'),
--     ('日本大阪', CURRENT_DATE + 20, CURRENT_DATE + 24, '希望一起分擔交通與住宿，白天景點晚上居酒屋。', '旅人 B', 'open')
-- ) AS seed(city, start_date, end_date, note, display_name, status)
-- WHERE NOT EXISTS (SELECT 1 FROM public.travel_buddy_posts);
