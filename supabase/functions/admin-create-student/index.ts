// Admin-only: creates a student account given national_id and full_name.
// Admin-only: creates a student account given national_id and full_name.
// Initial password = national_id. must_change_password=true; app forces password change before access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: cors, status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { headers: cors, status: 401 });
    }
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { headers: cors, status: 403 });
    }

    const body = await req.json();

    // Single-student mode (legacy) OR bulk mode
    if (Array.isArray(body.students)) {
      return await handleBulk(supabase, body);
    }

    const national_id = String(body.national_id ?? "").trim();
    const full_name = String(body.full_name ?? "").trim();
    const course_id = body.course_id ? String(body.course_id) : null;

    if (!/^\d{14}$/.test(national_id)) {
      return new Response(JSON.stringify({ error: "الرقم القومي يجب أن يكون 14 رقمًا بالضبط" }), { headers: cors, status: 400 });
    }
    if (full_name.length < 2 || full_name.length > 120) {
      return new Response(JSON.stringify({ error: "الاسم غير صالح" }), { headers: cors, status: 400 });
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("national_id", national_id)
      .maybeSingle();

    let studentId: string;
    let created = false;

    if (existing) {
      studentId = existing.id;
    } else {
      const result = await createStudentAccount(supabase, national_id, full_name);
      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.error ?? "تعذر الإنشاء" }), { headers: cors, status: 500 });
      }
      studentId = result.id;
      created = true;
    }

    // Optionally enroll in course
    if (course_id) {
      await supabase.from("course_students").insert({
        course_id,
        student_id: studentId,
      }).select();
    }

    return new Response(JSON.stringify({ ok: true, student_id: studentId, created }), {
      headers: cors,
    });
  } catch {
    return new Response(JSON.stringify({ error: "حدث خطأ غير متوقع" }), { headers: cors, status: 500 });
  }
});

async function createStudentAccount(supabase: any, national_id: string, full_name: string) {
  const fakeEmail = `${national_id}@students.local`;
  const { data: createdUser, error: cErr } = await supabase.auth.admin.createUser({
    email: fakeEmail,
    password: national_id,
    email_confirm: true,
    user_metadata: { national_id, full_name },
  });
  if (cErr || !createdUser.user) {
    return { error: "تعذر إنشاء حساب الطالب" };
  }
  const studentId = createdUser.user.id;
  const { error: pErr } = await supabase.from("profiles").insert({
    id: studentId,
    national_id,
    full_name,
    must_change_password: true,
  });
  if (pErr) return { error: "تعذر حفظ بيانات الطالب" };
  const { error: rErr } = await supabase.from("user_roles").insert({
    user_id: studentId,
    role: "student",
  });
  if (rErr) return { error: "تعذر تعيين صلاحية الطالب" };
  return { id: studentId };
}

async function handleBulk(supabase: any, body: any) {
  const course_id = body.course_id ? String(body.course_id) : null;
  const students = body.students as Array<{ national_id: string; full_name: string }>;

  const results = {
    created: 0,
    enrolled: 0,
    skipped: [] as Array<{ row: number; national_id: string; full_name: string; reason: string }>,
  };

  for (let i = 0; i < students.length; i++) {
    const row = students[i];
    const nid = String(row.national_id ?? "").trim();
    const name = String(row.full_name ?? "").trim();

    if (!/^\d{14}$/.test(nid)) {
      results.skipped.push({ row: i + 1, national_id: nid, full_name: name, reason: "الرقم القومي ليس 14 رقمًا" });
      continue;
    }
    if (name.length < 2 || name.length > 120) {
      results.skipped.push({ row: i + 1, national_id: nid, full_name: name, reason: "اسم غير صالح" });
      continue;
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("national_id", nid)
      .maybeSingle();

    let studentId: string;
    if (existing) {
      studentId = existing.id;
    } else {
      const created = await createStudentAccount(supabase, nid, name);
      if ("error" in created) {
        results.skipped.push({ row: i + 1, national_id: nid, full_name: name, reason: created.error ?? "تعذر الإنشاء" });
        continue;
      }
      studentId = created.id;
      results.created++;
    }

    if (course_id) {
      const { error: eErr } = await supabase
        .from("course_students")
        .insert({ course_id, student_id: studentId });
      if (!eErr) results.enrolled++;
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), { headers: cors });
}
