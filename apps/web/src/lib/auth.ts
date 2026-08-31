import "server-only";

import { createSupabaseServerClient } from "./supabase-server";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function getAdminContext() {
  const context = await getAuthenticatedUser();
  const allowlist = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    ...context,
    isAdmin: Boolean(context.user?.email && allowlist.has(context.user.email.toLowerCase())),
  };
}
