// Seeds the default admin user. Idempotent - safe to call multiple times.
// Public endpoint - only creates the predefined admin if missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const ADMIN_NATIONAL_ID = "30409302705178";
const ADMIN_DEFAULT_PASSWORD = "Admin";
const ADMIN_FAKE_EMAIL = `${ADMIN_NATIONAL_ID}@admin.local`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if admin profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("national_id", ADMIN_NATIONAL_ID)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, created: false }), { headers: cors });
    }

    // Create the admin user via auth admin API
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_FAKE_EMAIL,
      password: ADMIN_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { national_id: ADMIN_NATIONAL_ID, full_name: "المسؤول" },
    });

    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ ok: false, error: createErr?.message ?? "create failed" }),
        { headers: cors, status: 500 }
      );
    }

    const userId = created.user.id;

    // Insert profile
    const { error: profErr } = await supabase.from("profiles").insert({
      id: userId,
      national_id: ADMIN_NATIONAL_ID,
      full_name: "المسؤول",
      must_change_password: false,
    });
    if (profErr) {
      return new Response(JSON.stringify({ ok: false, error: profErr.message }), {
        headers: cors,
        status: 500,
      });
    }

    // Insert admin role
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
    if (roleErr) {
      return new Response(JSON.stringify({ ok: false, error: roleErr.message }), {
        headers: cors,
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true, created: true }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: cors,
      status: 500,
    });
  }
});
