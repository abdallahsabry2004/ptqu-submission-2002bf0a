// Admin-only: returns signed URLs for all submissions of a given assignment.
// The frontend then downloads each individually (or bundles client-side).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: cors, status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: cors, status: 401 });
    }
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { headers: cors, status: 403 });
    }

    const { assignment_id, submission_id } = await req.json();

    let query = supabase
      .from("submissions")
      .select("id, file_path, file_name, student_id, profiles!submissions_student_id_fkey(full_name, national_id)");

    if (submission_id) {
      query = query.eq("id", submission_id);
    } else if (assignment_id) {
      query = query.eq("assignment_id", assignment_id);
    } else {
      return new Response(JSON.stringify({ error: "missing params" }), { headers: cors, status: 400 });
    }

    const { data: subs, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { headers: cors, status: 500 });
    }

    const files = await Promise.all(
      (subs ?? []).map(async (s: any) => {
        const { data: signed } = await supabase.storage
          .from("submissions")
          .createSignedUrl(s.file_path, 60 * 10);
        return {
          submission_id: s.id,
          file_name: s.file_name,
          student_name: s.profiles?.full_name ?? "",
          national_id: s.profiles?.national_id ?? "",
          url: signed?.signedUrl,
        };
      })
    );

    return new Response(JSON.stringify({ files }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: cors, status: 500 });
  }
});
