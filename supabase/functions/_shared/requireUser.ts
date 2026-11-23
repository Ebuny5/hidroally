import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Returns the signed-in user for this request, or null when the token is missing/invalid. */
export async function getRequestUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}
