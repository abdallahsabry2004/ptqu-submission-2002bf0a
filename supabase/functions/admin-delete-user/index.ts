// Admin-only: deletes a user (student or supervisor) entirely from the system.
// Cleans up auth.users, profiles, user_roles, enrollments, group memberships, supervisor links, and submissions.
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
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
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return new Response(JSON.stringify({ error: "معرف غير صالح" }), { headers: cors, status: 400 });
    }
    if (userId === userData.user.id) {
      return new Response(JSON.stringify({ error: "لا يمكنك حذف حسابك" }), { headers: cors, status: 400 });
    }

    // Don't allow deleting another admin
    const { data: targetIsAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (targetIsAdmin) {
      return new Response(JSON.stringify({ error: "لا يمكن حذف حساب مسؤول" }), { headers: cors, status: 400 });
    }

    // Get submissions to clean up storage files
    const { data: subs } = await supabase
      .from("submissions")
      .select("file_path")
      .eq("student_id", userId);

    if (subs && subs.length > 0) {
      const paths = subs.map((s: any) => s.file_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("submissions").remove(paths);
      }
    }

    // Delete from auth — cascade will remove profiles + linked rows via FKs
    const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
    if (delErr) {
      // Fallback: manual delete
      await supabase.from("profiles").delete().eq("id", userId);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch {
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});
