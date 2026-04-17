// Legacy endpoint kept only to avoid breaking older clients.
// It no longer reveals whether a national ID exists or returns auth emails.
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
      return new Response(JSON.stringify({ ok: true, message: "invalid credentials" }), { headers: cors, status: 200 });
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Use the login flow directly." }),
      { headers: cors, status: 200 }
    );
  } catch {
    return new Response(JSON.stringify({ ok: true, message: "invalid credentials" }), {
      headers: cors,
      status: 200,
    });
  }
});
