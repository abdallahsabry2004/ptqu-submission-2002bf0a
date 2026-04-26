// Admin-only: sets a new password for a target user (student or supervisor)
// and stores the visible value in profiles.current_password so the admin
// can share it with the user.
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
      return new Response(JSON.stringify({ error: "غير مصرح" }), { headers: cors, status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "جلسة غير صالحة" }), { headers: cors, status: 401 });
    }
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "صلاحيات غير كافية" }), { headers: cors, status: 403 });
    }

    const body = await req.json();
    const userId = String(body.user_id ?? "").trim();
    const newPassword = String(body.password ?? "").trim();
    const requestId = body.request_id ? String(body.request_id) : null;

    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return new Response(JSON.stringify({ error: "معرف غير صالح" }), { headers: cors, status: 400 });
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      return new Response(JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }), { headers: cors, status: 400 });
    }

    // Don't allow changing another admin's password
    const { data: targetIsAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (targetIsAdmin && userId !== userData.user.id) {
      return new Response(JSON.stringify({ error: "لا يمكن تغيير كلمة مرور حساب مسؤول آخر" }), { headers: cors, status: 400 });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { headers: cors, status: 500 });
    }

    // Mirror the visible password in profile so admin can share it
    await supabase
      .from("profiles")
      .update({ current_password: newPassword, must_change_password: false })
      .eq("id", userId);

    if (requestId) {
      await supabase
        .from("password_reset_requests")
        .update({
          status: "resolved",
          resolved_by: userData.user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});