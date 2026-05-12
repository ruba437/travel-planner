CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash character varying(128) NOT NULL UNIQUE,
  expires_at timestamp without time zone NOT NULL,
  used_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON public.password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON public.password_reset_tokens (expires_at);