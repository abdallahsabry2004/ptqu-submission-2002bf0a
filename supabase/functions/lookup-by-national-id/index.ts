// Public: given a national_id, returns the fake email used for auth login.
// This lets the login form translate national_id -> internal email for signInWithPassword.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { national_id } = await req.json();
    const nid = String(national_id ?? "").trim();
    if (!/^\d{5,20}$/.test(nid)) {
      return new Response(JSON.stringify({ error: "invalid" }), { headers: cors, status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, national_id")
      .eq("national_id", nid)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "not_found" }), { headers: cors, status: 404 });
    }

    // Fetch the auth user to get the actual email
    const { data: userData, error } = await supabase.auth.admin.getUserById(profile.id);
    if (error || !userData.user) {
      return new Response(JSON.stringify({ error: "not_found" }), { headers: cors, status: 404 });
    }

    return new Response(JSON.stringify({ email: userData.user.email }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: cors, status: 500 });
  }
});
