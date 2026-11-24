-- 1. Revocar enumeracion publica de correos para el rol anon
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_email_exists'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_email_exists(text) FROM anon, PUBLIC';
  END IF;
END $$;

-- 2. Tabla y funcion atomica de Rate Limiting para proteger la API de IA (Groq/Gemini)
CREATE TABLE IF NOT EXISTS public.ai_chat_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.ai_chat_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI quota" ON public.ai_chat_rate_limits;
CREATE POLICY "Users can view own AI quota"
  ON public.ai_chat_rate_limits
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.consume_ai_chat_quota(
  p_max_requests integer DEFAULT 30,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_bucket timestamptz;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_bucket := date_trunc('hour', now())
    + (floor(extract(minute FROM now()) / GREATEST(p_window_minutes, 1)) * GREATEST(p_window_minutes, 1)) * interval '1 minute';

  INSERT INTO public.ai_chat_rate_limits (user_id, window_start, request_count)
  VALUES (v_user_id, v_bucket, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET request_count = public.ai_chat_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_chat_quota(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_chat_quota(integer, integer) TO authenticated;

-- 3. Persistencia segura de conversaciones del Copiloto Agronomico
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id uuid NULL,
  title text NOT NULL DEFAULT 'Consulta agronómica',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) <= 12000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own AI conversations" ON public.ai_conversations;
CREATE POLICY "Users manage own AI conversations"
  ON public.ai_conversations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own AI messages" ON public.ai_messages;
CREATE POLICY "Users manage own AI messages"
  ON public.ai_messages
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
