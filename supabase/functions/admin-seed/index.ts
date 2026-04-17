// Seeds the default admin user. Idempotent - safe to call multiple times.
// Requires X-Seed-Token header matching ADMIN_SEED_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-token",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const seedToken = req.headers.get("x-seed-token");
    const expectedSeedToken = Deno.env.get("ADMIN_SEED_SECRET");
    if (!expectedSeedToken || !seedToken || seedToken !== expectedSeedToken) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        headers: cors,
        status: 401,
      });
    }

    const ADMIN_NATIONAL_ID = Deno.env.get("ADMIN_NATIONAL_ID");
    const ADMIN_SEED_PASSWORD = Deno.env.get("ADMIN_SEED_PASSWORD");

    if (!ADMIN_NATIONAL_ID || !ADMIN_SEED_PASSWORD || !/^\d{5,20}$/.test(ADMIN_NATIONAL_ID)) {
      return new Response(JSON.stringify({ ok: false, error: "Seed unavailable" }), {
        headers: cors,
        status: 500,
      });
    }

    const ADMIN_FAKE_EMAIL = `${ADMIN_NATIONAL_ID}@admin.local`;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("national_id", ADMIN_NATIONAL_ID)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, created: false }), { headers: cors });
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_FAKE_EMAIL,
      password: ADMIN_SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { national_id: ADMIN_NATIONAL_ID, full_name: "المسؤول" },
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ ok: false, error: "Seed failed" }), {
        headers: cors,
        status: 500,
      });
    }

    const userId = created.user.id;

    const { error: profErr } = await supabase.from("profiles").insert({
      id: userId,
      national_id: ADMIN_NATIONAL_ID,
      full_name: "المسؤول",
      must_change_password: true,
    });
    if (profErr) {
      return new Response(JSON.stringify({ ok: false, error: "Seed failed" }), {
        headers: cors,
        status: 500,
      });
    }

    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
    if (roleErr) {
      return new Response(JSON.stringify({ ok: false, error: "Seed failed" }), {
        headers: cors,
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true, created: true }), { headers: cors });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Seed failed" }), {
      headers: cors,
      status: 500,
    });
  }
});
