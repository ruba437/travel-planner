-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.itineraries (
  id integer,
  userid integer NOT NULL,
  uuid character varying(36) NOT NULL UNIQUE,
  title character varying,
  summary text,
  city character varying,
  startdate date,
  itinerarydata text NOT NULL,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updatedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  ispublic boolean DEFAULT false,
  CONSTRAINT itineraries_pkey PRIMARY KEY (id),
  CONSTRAINT itineraries_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id)
);

CREATE TABLE public.oauth_tokens (
  id integer NOT NULL DEFAULT nextval('oauth_tokens_id_seq'::regclass),
  oauthaccountid integer NOT NULL,
  refreshtoken character varying,
  expiresat timestamp without time zone,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT oauth_tokens_oauthaccountid_fkey FOREIGN KEY (oauthaccountid) REFERENCES public.user_oauth_accounts(id)
);

CREATE TABLE public.user_oauth_accounts (
  id integer NOT NULL DEFAULT nextval('user_oauth_accounts_id_seq'::regclass),
  userid integer NOT NULL,
  provider character varying NOT NULL,
  provideruserid character varying NOT NULL,
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_oauth_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT user_oauth_accounts_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(id)
);

CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
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

CREATE TABLE public.trending_destinations (
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

CREATE INDEX trending_destinations_score_idx
  ON public.trending_destinations (score DESC, trip_count DESC, updatedat DESC);

CREATE TABLE public.travel_guides (
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

CREATE INDEX travel_guides_published_idx
  ON public.travel_guides (is_published, publishedat DESC, updatedat DESC);
CREATE UNIQUE INDEX travel_guides_slug_uidx
  ON public.travel_guides (slug)
  WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX travel_guides_guide_code_uidx
  ON public.travel_guides (guide_code)
  WHERE guide_code IS NOT NULL;
