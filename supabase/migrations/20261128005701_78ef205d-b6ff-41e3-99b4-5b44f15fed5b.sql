CREATE OR REPLACE FUNCTION public.register_native_device(
  p_token text,
  p_platform text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_previous_token text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_endpoint text;
  v_lat double precision := p_latitude;
  v_lon double precision := p_longitude;
BEGIN
  IF p_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'invalid platform';
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 4096 OR p_token ~ '\s' THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  IF v_lat IS NULL OR v_lon IS NULL OR v_lat < -90 OR v_lat > 90 OR v_lon < -180 OR v_lon > 180 THEN
    v_lat := NULL;
    v_lon := NULL;
  END IF;
  IF p_app_version IS NOT NULL AND length(p_app_version) > 64 THEN
    p_app_version := left(p_app_version, 64);
  END IF;

  v_endpoint := 'native:' || p_platform || ':' || p_token;

  -- Token rotated: remove the stale row only if it is a guest row or belongs to the caller.
  IF p_previous_token IS NOT NULL AND p_previous_token <> p_token THEN
    DELETE FROM public.push_subscriptions
    WHERE endpoint = 'native:' || p_platform || ':' || p_previous_token
      AND (user_id IS NULL OR user_id = v_uid);
  END IF;

  INSERT INTO public.push_subscriptions
    (endpoint, kind, platform, device_token, user_id, is_active, app_version, last_seen_at, latitude, longitude)
  VALUES
    (v_endpoint, p_platform, p_platform, p_token, v_uid, true, p_app_version, now(), v_lat, v_lon)
  ON CONFLICT (endpoint) DO UPDATE SET
    is_active = true,
    device_token = EXCLUDED.device_token,
    last_seen_at = now(),
    app_version = COALESCE(EXCLUDED.app_version, public.push_subscriptions.app_version),
    latitude = COALESCE(EXCLUDED.latitude, public.push_subscriptions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, public.push_subscriptions.longitude),
    -- A signed-in caller claims the device; a guest call never unbinds an account.
    user_id = COALESCE(v_uid, public.push_subscriptions.user_id);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unbind_native_device(
  p_token text,
  p_platform text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_platform NOT IN ('android', 'ios') OR p_token IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.push_subscriptions
  SET user_id = NULL, last_reminder_sent_at = NULL
  WHERE endpoint = 'native:' || p_platform || ':' || p_token
    AND user_id = v_uid;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_native_device(text, text, double precision, double precision, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_native_device(text, text, double precision, double precision, text, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.unbind_native_device(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unbind_native_device(text, text) TO authenticated, service_role;