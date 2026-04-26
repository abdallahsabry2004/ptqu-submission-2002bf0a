import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface StudentRow {
  id: string;
  national_id: string;
  full_name: string;
  email: string | null;
}

const AdminStudents = () => {
  const { role, user } = useAuth();
  const isSupervisor = role === "supervisor";
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let ids: string[] = [];

    if (isSupervisor && user) {
      // Supervisor: only sees students enrolled in their courses
      const { data: links } = await supabase
        .from("course_supervisors")
        .select("course_id")
        .eq("supervisor_id", user.id);
      const courseIds = (links ?? []).map((l: any) => l.course_id);
      if (courseIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }
      const { data: enr } = await supabase
        .from("course_students")
        .select("student_id")
        .in("course_id", courseIds);
      ids = Array.from(new Set(((enr as any) ?? []).map((r: any) => r.student_id)));
    } else {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      ids = (roles ?? []).map((r: any) => r.user_id);
    }

    if (ids.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, national_id, full_name, email")
      .in("id", ids)
      .order("full_name");
    setStudents((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupervisor, user?.id]);

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(q.toLowerCase()) ||
      s.national_id.includes(q)
  );

  const startEdit = (s: StudentRow) => {
    setEditId(s.id);
    setEditName(s.full_name);
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (editName.trim().length < 2) {
      toast.error("الاسم غير صالح");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim() })
      .eq("id", editId);
    if (error) toast.error("تعذر تعديل الاسم");
    else {
      toast.success("تم الحفظ");
      setEditId(null);
      load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الطالب نهائيًا من المنصة؟ سيتم حذف كل تسليماته.")) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: id },
    });
    if (error || data?.error) toast.error(data?.error ?? error?.message ?? "خطأ");
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  // Supervisor: remove student from all of supervisor's own courses
  const removeFromMyCourses = async (studentId: string) => {
    if (!user) return;
    if (!confirm("إزالة الطالب من جميع مقرراتك؟ (لن يُحذف حسابه من المنصة)")) return;
    const { data: links } = await supabase
      .from("course_supervisors")
      .select("course_id")
      .eq("supervisor_id", user.id);
    const courseIds = ((links as any) ?? []).map((l: any) => l.course_id);
    if (courseIds.length === 0) {
      toast.error("لا توجد مقررات تابعة لك");
      return;
    }
    const { error } = await supabase
      .from("course_students")
      .delete()
      .in("course_id", courseIds)
      .eq("student_id", studentId);
    if (error) toast.error(error.message);
    else {
      toast.success("تمت الإزالة من مقرراتك");
      load();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {isSupervisor ? "طلاب مقرراتي" : "جميع الطلاب"}
          </h1>
          <p className="text-muted-foreground">
            {isSupervisor
              ? "عرض كل الطلاب المسجلين في مقرراتك (الرقم القومي = المعرف الوحيد)"
              : "عرض وتعديل وحذف الطلاب المسجلين"}
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو الرقم القومي"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لا يوجد طلاب</p>
              <p className="text-xs text-muted-foreground mt-2">
                أضف الطلاب من داخل تفاصيل أي مقرر
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.full_name}</p>
                      <p className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {s.national_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isSupervisor && (
                        <>
                          <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(s)}
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(s.id)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                        </>
                      )}
                      {isSupervisor && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromMyCourses(s.id)}
                          aria-label="إزالة من مقرراتي"
                          title="إزالة من مقرراتي"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل اسم الطالب</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>الاسم الكامل</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={saveEdit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminStudents;
