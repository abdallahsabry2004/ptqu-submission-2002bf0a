// Public: given national_id, records a password-reset request that the admin
// will see in their dashboard. We never reveal whether the national_id exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const OK = JSON.stringify({
  ok: true,
  message: "تم استلام طلبك. سيتواصل معك المسؤول قريبًا بكلمة المرور الجديدة.",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { national_id, message } = await req.json();
    const nid = String(national_id ?? "").trim();
    const note = (message ? String(message) : "").trim().slice(0, 500);

    if (!/^\d{5,20}$/.test(nid)) {
      return new Response(JSON.stringify({ error: "الرقم القومي غير صالح" }), { headers: cors, status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, national_id")
      .eq("national_id", nid)
      .maybeSingle();

    // Always return success to avoid leaking whether the ID exists.
    if (!profile) return new Response(OK, { headers: cors });

    // Avoid spamming: if there's already a pending request for this user, reuse it.
    const { data: existing } = await supabase
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "pending")
      .maybeSingle();

    if (!existing) {
      await supabase.from("password_reset_requests").insert({
        user_id: profile.id,
        national_id: profile.national_id,
        message: note || null,
      });
    }

    return new Response(OK, { headers: cors });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});
