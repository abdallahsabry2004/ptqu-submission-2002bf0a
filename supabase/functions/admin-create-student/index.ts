// Admin-only: creates a student account given national_id and full_name.
// Initial password = national_id. must_change_password=true.
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
    const national_id = String(body.national_id ?? "").trim();
    const full_name = String(body.full_name ?? "").trim();
    const course_id = body.course_id ? String(body.course_id) : null;

    if (!/^\d{5,20}$/.test(national_id)) {
      return new Response(JSON.stringify({ error: "الرقم القومي غير صالح" }), { headers: cors, status: 400 });
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
      const fakeEmail = `${national_id}@students.local`;
      const { data: createdUser, error: cErr } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: national_id,
        email_confirm: true,
        user_metadata: { national_id, full_name },
      });
      if (cErr || !createdUser.user) {
        return new Response(JSON.stringify({ error: cErr?.message ?? "إنشاء فشل" }), {
          headers: cors,
          status: 500,
        });
      }
      studentId = createdUser.user.id;
      const { error: pErr } = await supabase.from("profiles").insert({
        id: studentId,
        national_id,
        full_name,
        must_change_password: true,
      });
      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), { headers: cors, status: 500 });
      }
      const { error: rErr } = await supabase.from("user_roles").insert({
        user_id: studentId,
        role: "student",
      });
      if (rErr) {
        return new Response(JSON.stringify({ error: rErr.message }), { headers: cors, status: 500 });
      }
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
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers: cors, status: 500 });
  }
});
