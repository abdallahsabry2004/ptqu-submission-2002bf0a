// Admin-only: creates a supervisor (doctor) account given national_id and full_name.
// Initial password = national_id. must_change_password=true.
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
    const national_id = String(body.national_id ?? "").trim();
    const full_name = String(body.full_name ?? "").trim();
    const course_ids: string[] = Array.isArray(body.course_ids) ? body.course_ids : [];

    if (!/^\d{5,20}$/.test(national_id)) {
      return new Response(JSON.stringify({ error: "الرقم القومي غير صالح" }), { headers: cors, status: 400 });
    }
    if (full_name.length < 2 || full_name.length > 120) {
      return new Response(JSON.stringify({ error: "الاسم غير صالح" }), { headers: cors, status: 400 });
    }

    // Check if already exists by national_id
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("national_id", national_id)
      .maybeSingle();

    let supervisorId: string;
    let created = false;

    if (existing) {
      supervisorId = existing.id;
      // Make sure they have the supervisor role
      await supabase.from("user_roles").upsert(
        { user_id: supervisorId, role: "supervisor" },
        { onConflict: "user_id,role", ignoreDuplicates: true }
      );
    } else {
      const fakeEmail = `${national_id}@supervisors.local`;
      const { data: createdUser, error: cErr } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: national_id,
        email_confirm: true,
        user_metadata: { national_id, full_name },
      });
      if (cErr || !createdUser.user) {
        return new Response(JSON.stringify({ error: "تعذر إنشاء الحساب" }), { headers: cors, status: 500 });
      }
      supervisorId = createdUser.user.id;
      const { error: pErr } = await supabase.from("profiles").insert({
        id: supervisorId,
        national_id,
        full_name,
        must_change_password: true,
      });
      if (pErr) {
        return new Response(JSON.stringify({ error: "تعذر حفظ بيانات الحساب" }), { headers: cors, status: 500 });
      }
      const { error: rErr } = await supabase.from("user_roles").insert({
        user_id: supervisorId,
        role: "supervisor",
      });
      if (rErr) {
        return new Response(JSON.stringify({ error: "تعذر تعيين الصلاحية" }), { headers: cors, status: 500 });
      }
      created = true;
    }

    // Assign to courses
    if (course_ids.length > 0) {
      await supabase
        .from("course_supervisors")
        .upsert(
          course_ids.map((cid) => ({ course_id: cid, supervisor_id: supervisorId })),
          { onConflict: "course_id,supervisor_id", ignoreDuplicates: true }
        );
    }

    return new Response(JSON.stringify({ ok: true, supervisor_id: supervisorId, created }), {
      headers: cors,
    });
  } catch {
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});
