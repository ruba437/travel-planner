-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- CREATE TABLE public.itineraries (
--   id integer,
--   userid integer NOT NULL,
--   uuid character varying(36) NOT NULL UNIQUE,
--   title character varying,
--   summary text,
--   city character varying,
--   startdate date,
--   itinerarydata text NOT NULL,
--   createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   ispublic boolean DEFAULT false,
--   CONSTRAINT itineraries_pkey PRIMARY KEY (id),
--   CONSTRAINT itineraries_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id)
-- );

-- -- oath 沒有實裝
-- CREATE TABLE public.oauth_tokens (
--   id integer NOT NULL DEFAULT nextval('oauth_tokens_id_seq'::regclass),
--   oauthaccountid integer NOT NULL,
--   refreshtoken character varying,
--   expiresat timestamp without time zone,
--   createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id),
--   CONSTRAINT oauth_tokens_oauthaccountid_fkey FOREIGN KEY (oauthaccountid) REFERENCES public.user_oauth_accounts(id)
-- );

-- CREATE TABLE public.user_oauth_accounts (
--   id integer NOT NULL DEFAULT nextval('user_oauth_accounts_id_seq'::regclass),
--   userid integer NOT NULL,
--   provider character varying NOT NULL,
--   provideruserid character varying NOT NULL,
--   createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT user_oauth_accounts_pkey PRIMARY KEY (id),
--   CONSTRAINT user_oauth_accounts_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id)
-- );
-- --

-- CREATE TABLE public.users (
--   id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
--   email character varying NOT NULL UNIQUE,
--   username character varying,
--   displayname character varying,
--   profilephoto character varying,
--   passwordhash character varying,
--   createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   isactive boolean DEFAULT true,
--   CONSTRAINT users_pkey PRIMARY KEY (id)
-- );

-- -- ============================================================
-- -- Aizzie-style City Guide — schema additions
-- -- ============================================================

-- -- 1. City meta  (hero image, description, coords)
-- CREATE TABLE IF NOT EXISTS public.cities (
--   id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   city        character varying NOT NULL,
--   country     character varying,
--   description text,
--   cover_image text,
--   latitude    numeric(10, 6),
--   longitude   numeric(10, 6),
--   is_active   boolean DEFAULT true,
--   createdat   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   updatedat   timestamp without time zone DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE UNIQUE INDEX IF NOT EXISTS cities_city_country_uidx
--   ON public.cities (lower(city), lower(country));

-- -- 2. Generic point-of-interest table (covers all card sections)
-- --    category: 'place' | 'hotel' | 'restaurant' | 'activity' | 'transport'
-- CREATE TABLE IF NOT EXISTS public.city_pois (
--   id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   city_id      integer NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
--   category     character varying NOT NULL
--                  CHECK (category IN ('place','hotel','restaurant','activity','transport')),
--   name         character varying NOT NULL,
--   description  text,
--   cover_image  text,
--   star_rating  integer CHECK (star_rating BETWEEN 1 AND 5),
--   book_url     text,
--   sort_order   integer DEFAULT 0,
--   is_active    boolean DEFAULT true,
--   createdat    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   updatedat    timestamp without time zone DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX IF NOT EXISTS city_pois_city_category_idx
--   ON public.city_pois (city_id, category, sort_order);



-- --- 還沒用
-- -- 3. Saved / favourited items per user  (heart button)
-- CREATE TABLE IF NOT EXISTS public.user_saved_pois (
--   id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   userid    integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
--   poi_id    integer NOT NULL REFERENCES public.city_pois(id) ON DELETE CASCADE,
--   savedat   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE (userid, poi_id)
-- );

-- -- 4. User saved cities (destination wishlist)
-- CREATE TABLE IF NOT EXISTS public.user_saved_cities (
--   id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   userid    integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
--   city_id   integer NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
--   savedat   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE (userid, city_id)
-- );


-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  email character varying NOT NULL UNIQUE,
  username character varying,
  displayname character varying,
  profilephoto character varying,
  passwordhash character varying,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  isactive boolean DEFAULT true,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cities (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  city character varying NOT NULL,
  country character varying,
  description text,
  cover_image text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  score real,
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.city_pois (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  city_id integer NOT NULL,
  category character varying NOT NULL CHECK (category::text = ANY (ARRAY['place'::character varying, 'hotel'::character varying, 'restaurant'::character varying, 'activity'::character varying, 'transport'::character varying]::text[])),
  name character varying NOT NULL,
  description text,
  cover_image text,
  star_rating integer CHECK (star_rating >= 1 AND star_rating <= 5),
  book_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT city_pois_pkey PRIMARY KEY (id),
  CONSTRAINT city_pois_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
CREATE TABLE public.itineraries (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  userid integer NOT NULL,
  uuid character varying NOT NULL UNIQUE,
  title character varying,
  summary text,
  city character varying,
  startdate date,
  starttime time without time zone,
  note text,
  itinerarydata text NOT NULL,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  ispublic boolean DEFAULT false,
  CONSTRAINT itineraries_pkey PRIMARY KEY (id),
  CONSTRAINT itineraries_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id)
);
CREATE TABLE public.itinerary_checklist_items (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  itinerary_uuid character varying NOT NULL,
  item_text character varying NOT NULL,
  is_checked boolean DEFAULT false,
  is_reminder boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT itinerary_checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT itinerary_checklist_items_itinerary_uuid_fkey FOREIGN KEY (itinerary_uuid) REFERENCES public.itineraries(uuid) ON DELETE CASCADE
);
CREATE TABLE public.user_saved_cities (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  userid integer NOT NULL,
  city_id integer NOT NULL,
  savedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_saved_cities_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_cities_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id),
  CONSTRAINT user_saved_cities_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
CREATE TABLE public.user_saved_pois (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  userid integer NOT NULL,
  poi_id integer NOT NULL,
  savedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_saved_pois_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_pois_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id),
  CONSTRAINT user_saved_pois_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES public.city_pois(id)
);


CREATE INDEX itinerary_checklist_items_uuid_order_idx
  ON public.itinerary_checklist_items (itinerary_uuid, sort_order, id);