CREATE TABLE public.welcome_email_deliveries (
 user_id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
GRANT ALL ON public.welcome_email_deliveries TO service_role;
REVOKE ALL ON public.welcome_email_deliveries FROM anon, authenticated;
ALTER TABLE public.welcome_email_deliveries ENABLE ROW LEVEL SECURITY;
INSERT INTO public.welcome_email_deliveries(user_id,status,sent_at)
 SELECT id,'sent',now() FROM auth.users ON CONFLICT(user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.email_confirmed_at IS NOT NULL THEN
  IF TG_OP = 'INSERT' THEN
   INSERT INTO public.welcome_email_deliveries(user_id) VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
  ELSIF OLD.email_confirmed_at IS NULL THEN
   INSERT INTO public.welcome_email_deliveries(user_id) VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_welcome_email() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_welcome_email() TO service_role;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.trigger_welcome_email();