import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { profilePatchSchema } from "@/lib/schemas/profile";

export const PATCH = withAuth(async (req, { supabase, userId }) => {
  const patch = await parseBody(req, profilePatchSchema);
  const { data, error } = await supabase.from("profiles").update(patch).eq("user_id", userId).select("*").single();
  dbError(error);
  return ok({ profile: data });
});
