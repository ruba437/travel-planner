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