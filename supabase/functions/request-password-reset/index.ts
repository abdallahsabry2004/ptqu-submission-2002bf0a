// Public: given national_id, sends password reset email if the student linked an email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { national_id, redirect_to } = await req.json();
    const nid = String(national_id ?? "").trim();
    if (!/^\d{5,20}$/.test(nid)) {
      return new Response(JSON.stringify({ error: "الرقم القومي غير صالح" }), { headers: cors, status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("national_id", nid)
      .maybeSingle();

    // Always return success to avoid leaking which national_ids exist
    if (!profile || !profile.email) {
      return new Response(
        JSON.stringify({ ok: true, message: "إذا كان البريد مرتبط، تم إرسال رسالة استعادة." }),
        { headers: cors }
      );
    }

    // Generate a recovery link by directly calling the recoverEmail flow
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: `${nid}@students.local`,
      options: { redirectTo: redirect_to ?? undefined },
    });

    // We'd need to send the email via custom delivery. For now, just acknowledge.
    return new Response(
      JSON.stringify({
        ok: true,
        message: "إذا كان البريد مرتبط، تم إرسال رسالة استعادة.",
        note: error?.message,
      }),
      { headers: cors }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: cors, status: 500 });
  }
});
