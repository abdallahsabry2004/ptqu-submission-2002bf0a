import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCog, UserPlus, Trash2, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Supervisor {
  id: string;
  full_name: string;
  national_id: string;
  course_ids: string[];
}
interface Course {
  id: string;
  name: string;
}

const AdminSupervisors = () => {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [nid, setNid] = useState("");
  const [name, setName] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: roles }, { data: cs }, { data: links }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "supervisor"),
      supabase.from("courses").select("id, name").order("name"),
      supabase.from("course_supervisors").select("supervisor_id, course_id"),
    ]);
    const ids = (roles ?? []).map((r: any) => r.user_id);
    let profs: any[] = [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, national_id")
        .in("id", ids)
        .order("full_name");
      profs = data ?? [];
    }
    const linkMap = new Map<string, string[]>();
    for (const l of links ?? []) {
      const list = linkMap.get((l as any).supervisor_id) ?? [];
      list.push((l as any).course_id);
      linkMap.set((l as any).supervisor_id, list);
    }
    setSupervisors(
      profs.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        national_id: p.national_id,
        course_ids: linkMap.get(p.id) ?? [],
      }))
    );
    setCourses((cs as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!/^\d{5,20}$/.test(nid.trim())) {
      toast.error("الرقم القومي غير صالح");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("الاسم مطلوب");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-supervisor", {
      body: { national_id: nid.trim(), full_name: name.trim(), course_ids: selectedCourses },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "خطأ");
    } else {
      toast.success(data.created ? "تم إنشاء حساب المشرف" : "تم تحديث المشرف وإسناد المقررات");
      setNid("");
      setName("");
      setSelectedCourses([]);
      setOpen(false);
      load();
    }
    setCreating(false);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا المشرف نهائيًا؟")) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: id },
    });
    if (error || data?.error) toast.error(data?.error ?? error?.message ?? "خطأ");
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const startEdit = (s: Supervisor) => {
    setEditId(s.id);
    setEditName(s.full_name);
    setEditCourses([...s.course_ids]);
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (editName.trim().length < 2) {
      toast.error("الاسم غير صالح");
      return;
    }
    setSavingEdit(true);
    // Update name
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim() })
      .eq("id", editId);
    if (pErr) {
      toast.error("تعذر تعديل الاسم");
      setSavingEdit(false);
      return;
    }
    // Sync course assignments
    const current =
      supervisors.find((s) => s.id === editId)?.course_ids ?? [];
    const toAdd = editCourses.filter((c) => !current.includes(c));
    const toRemove = current.filter((c) => !editCourses.includes(c));
    if (toAdd.length > 0) {
      await supabase
        .from("course_supervisors")
        .insert(toAdd.map((cid) => ({ course_id: cid, supervisor_id: editId })));
    }
    if (toRemove.length > 0) {
      await supabase
        .from("course_supervisors")
        .delete()
        .eq("supervisor_id", editId)
        .in("course_id", toRemove);
    }
    toast.success("تم الحفظ");
    setEditId(null);
    setSavingEdit(false);
    load();
  };

  const courseName = (cid: string) => courses.find((c) => c.id === cid)?.name ?? "—";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">المشرفون (الدكاترة)</h1>
            <p className="text-muted-foreground">
              إضافة المشرفين وتحديد المقررات الخاصة بكل مشرف
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                مشرف جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مشرف</DialogTitle>
                <DialogDescription>
                  كلمة المرور المبدئية = الرقم القومي، وسيُطلب من المشرف تغييرها عند أول دخول.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>الرقم القومي *</Label>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="14 رقم"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم المشرف الكامل *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>المقررات المسندة</Label>
                  {courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد مقررات بعد</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                      {courses.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedCourses.includes(c.id)}
                            onCheckedChange={(v) =>
                              setSelectedCourses((prev) =>
                                v ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                              )
                            }
                          />
                          <span className="text-sm">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  إضافة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : supervisors.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <UserCog className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لا يوجد مشرفون بعد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {supervisors.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-lg">{s.full_name}</p>
                      <p className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {s.national_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    {s.course_ids.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        لا توجد مقررات مسندة
                      </span>
                    ) : (
                      s.course_ids.map((cid) => (
                        <Badge key={cid} variant="secondary" className="font-normal">
                          {courseName(cid)}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل بيانات المشرف</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المقررات المسندة</Label>
                <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                  {courses.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={editCourses.includes(c.id)}
                        onCheckedChange={(v) =>
                          setEditCourses((prev) =>
                            v ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          )
                        }
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={saveEdit} disabled={savingEdit} className="gap-2">
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminSupervisors;
