// Public: given national_id, sends password reset email if the student linked an email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Allow-list for redirect_to: only the configured app URL (and its origin) is permitted.
function buildAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const appUrl = Deno.env.get("APP_URL");
  if (appUrl) {
    try { origins.add(new URL(appUrl).origin); } catch { /* ignore */ }
  }
  // Always allow the Supabase project URL origin as a safe fallback.
  const supaUrl = Deno.env.get("SUPABASE_URL");
  if (supaUrl) {
    try { origins.add(new URL(supaUrl).origin); } catch { /* ignore */ }
  }
  return [...origins];
}

function safeRedirect(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length === 0 || input.length > 500) return undefined;
  let url: URL;
  try { url = new URL(input); } catch { return undefined; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const allowed = buildAllowedOrigins();
  if (allowed.length > 0 && !allowed.includes(url.origin)) return undefined;
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { national_id, email, redirect_to } = await req.json();
    const nid = String(national_id ?? "").trim();
    const providedEmail = String(email ?? "").trim().toLowerCase();
    if (!/^\d{5,20}$/.test(nid)) {
      return new Response(JSON.stringify({ error: "الرقم القومي غير صالح" }), { headers: cors, status: 400 });
    }
    if (providedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)) {
      return new Response(JSON.stringify({ error: "بريد إلكتروني غير صالح" }), { headers: cors, status: 400 });
    }

    const validatedRedirect = safeRedirect(redirect_to);

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
    const emailMatches =
      !!profile?.email &&
      !!providedEmail &&
      profile.email.toLowerCase() === providedEmail;

    if (!emailMatches) {
      return new Response(
        JSON.stringify({ ok: true, message: "إذا كانت البيانات صحيحة، تم إرسال رابط الاستعادة." }),
        { headers: cors }
      );
    }

    // Try every internal-email pattern (student/supervisor/admin) — only one will match.
    const candidates = [
      `${nid}@students.local`,
      `${nid}@supervisors.local`,
      `${nid}@admin.local`,
    ];
    for (const internal of candidates) {
      try {
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email: internal,
          options: { redirectTo: validatedRedirect },
        });
      } catch { /* ignore individual failures */ }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "إذا كانت البيانات صحيحة، تم إرسال رابط الاستعادة.",
      }),
      { headers: cors }
    );
  } catch (_e) {
    // Do not leak internal error details
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});
