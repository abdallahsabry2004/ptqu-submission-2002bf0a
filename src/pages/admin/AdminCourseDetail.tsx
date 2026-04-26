import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Loader2, Users, UserPlus, Trash2, FileText, Pencil, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: string;
  national_id: string;
  full_name: string;
}
interface Group {
  id: string;
  name: string;
  member_ids: string[];
}

const AdminCourseDetail = () => {
  const { role } = useAuth();
  const isSupervisor = role === "supervisor";
  const baseRoute = isSupervisor ? "/supervisor" : "/admin";
  const { id: courseId } = useParams<{ id: string }>();
  const [courseName, setCourseName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // add student form
  const [addOpen, setAddOpen] = useState(false);
  const [nid, setNid] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  // bulk paste form
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulking, setBulking] = useState(false);

  // edit student name
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // add group form
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const load = async () => {
    if (!courseId) return;
    setLoading(true);
    const [{ data: c }, { data: cs }, { data: gs }] = await Promise.all([
      supabase.from("courses").select("name").eq("id", courseId).single(),
      supabase
        .from("course_students")
        .select("student_id")
        .eq("course_id", courseId),
      supabase
        .from("groups")
        .select("id, name, group_members(student_id)")
        .eq("course_id", courseId)
        .order("created_at"),
    ]);
    setCourseName((c as any)?.name ?? "");

    const studentIds = ((cs as any) ?? []).map((r: any) => r.student_id);
    let studentRows: Student[] = [];
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, national_id, full_name")
        .in("id", studentIds)
        .order("full_name");
      studentRows = (profs as any) ?? [];
    }
    setStudents(studentRows);

    setGroups(
      ((gs as any) ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        member_ids: (g.group_members ?? []).map((m: any) => m.student_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [courseId]);

  const addStudent = async () => {
    if (!/^\d{14}$/.test(nid.trim())) {
      toast.error("الرقم القومي يجب أن يكون 14 رقمًا بالضبط");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("الاسم مطلوب");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase.functions.invoke("admin-create-student", {
      body: { national_id: nid.trim(), full_name: name.trim(), course_id: courseId },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "خطأ");
    } else {
      toast.success(data.created ? "تم إضافة الطالب وإنشاء حسابه" : "تم إضافة الطالب للمقرر");
      setNid("");
      setName("");
      setAddOpen(false);
      load();
    }
    setAdding(false);
  };

  const bulkAdd = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("ألصق بيانات الطلاب أولًا");
      return;
    }
    const parsed: Array<{ national_id: string; full_name: string }> = [];
    for (const line of lines) {
      // Split by tab, comma, or multiple spaces
      const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      // Detect which part is the national ID (exactly 14 digits — Egyptian)
      const idIndex = parts.findIndex((p) => /^\d{14}$/.test(p));
      if (idIndex === -1) continue;
      const national_id = parts[idIndex];
      const full_name = parts.filter((_, i) => i !== idIndex).join(" ").trim();
      if (full_name.length < 2) continue;
      parsed.push({ national_id, full_name });
    }
    if (parsed.length === 0) {
      toast.error("لم يتم العثور على بيانات صالحة (تحتاج لاسم ورقم قومي في كل سطر)");
      return;
    }
    setBulking(true);
    const { data, error } = await supabase.functions.invoke("admin-create-student", {
      body: { students: parsed, course_id: courseId },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "خطأ");
    } else {
      const skipped = (data.skipped ?? []).length;
      toast.success(
        `تمت إضافة ${data.enrolled ?? 0} طالب للمقرر${
          skipped > 0 ? ` (تم تخطي ${skipped})` : ""
        }`
      );
      setBulkText("");
      setBulkOpen(false);
      load();
    }
    setBulking(false);
  };

  const startEditStudent = (s: Student) => {
    setEditId(s.id);
    setEditName(s.full_name);
  };

  const saveEditStudent = async () => {
    if (!editId) return;
    if (editName.trim().length < 2) {
      toast.error("الاسم غير صالح");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim() })
      .eq("id", editId);
    if (error) toast.error("تعذر الحفظ");
    else {
      toast.success("تم الحفظ");
      setEditId(null);
      load();
    }
    setSavingEdit(false);
  };
  const removeStudent = async (sid: string) => {
    if (!confirm("إزالة الطالب من المقرر؟")) return;
    const { error } = await supabase
      .from("course_students")
      .delete()
      .eq("course_id", courseId!)
      .eq("student_id", sid);
    if (error) toast.error(error.message);
    else {
      toast.success("تمت الإزالة");
      load();
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error("اسم المجموعة مطلوب");
      return;
    }
    if (groupMembers.length === 0) {
      toast.error("اختر أعضاء للمجموعة");
      return;
    }
    setCreatingGroup(true);
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .insert({ course_id: courseId!, name: groupName.trim() })
      .select("id, name")
      .single();
    if (gErr || !g) {
      console.error("createGroup error", gErr);
      toast.error(gErr?.message ?? "تعذر إنشاء المجموعة");
      setCreatingGroup(false);
      return;
    }
    const { error: mErr } = await supabase
      .from("group_members")
      .insert(groupMembers.map((sid) => ({ group_id: g.id, student_id: sid })));
    if (mErr) {
      console.error("group_members insert error", mErr);
      toast.error(`المجموعة أُنشئت لكن تعذّرت إضافة الأعضاء: ${mErr.message}`);
    } else {
      toast.success("تم إنشاء المجموعة");
    }
    setGroupName("");
    setGroupMembers([]);
    setGroupOpen(false);
    await load();
    setCreatingGroup(false);
  };

  const removeGroup = async (gid: string) => {
    if (!confirm("حذف المجموعة؟")) return;
    const { error } = await supabase.from("groups").delete().eq("id", gid);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const studentName = (sid: string) =>
    students.find((s) => s.id === sid)?.full_name ?? "—";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to={`${baseRoute}/courses`}>
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold">{courseName || "المقرر"}</h1>
            <p className="text-muted-foreground">إدارة الطلاب والمجموعات وطلبات التسليم</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="students">
            <TabsList>
              <TabsTrigger value="students" className="gap-2">
                <Users className="h-4 w-4" />
                الطلاب ({students.length})
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <Users className="h-4 w-4" />
                المجموعات ({groups.length})
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2">
                <FileText className="h-4 w-4" />
                طلبات التسليم
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="space-y-4">
              <div className="flex flex-wrap justify-end gap-2">
                {!isSupervisor && (
                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <ClipboardPaste className="h-4 w-4" />
                      إضافة دفعة من Excel
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>إضافة دفعة طلاب من Excel</DialogTitle>
                      <CardDescription>
                        انسخ عمودين من Excel (الاسم + الرقم القومي) والصقهم هنا — كل طالب في سطر منفصل.
                      </CardDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label>بيانات الطلاب</Label>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        rows={10}
                        dir="rtl"
                        placeholder={"أحمد محمد\t30101012345678\nفاطمة علي\t30202023456789"}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground">
                        افصل بين الاسم والرقم القومي بـ Tab أو فاصلة. كلمة المرور المبدئية لكل طالب = رقمه القومي.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={bulkAdd} disabled={bulking} className="gap-2">
                        {bulking && <Loader2 className="h-4 w-4 animate-spin" />}
                        إضافة الكل
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}

                {!isSupervisor && (
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      إضافة طالب
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة طالب للمقرر</DialogTitle>
                      <CardDescription>إذا لم يكن للطالب حساب، سيتم إنشاؤه (كلمة المرور = الرقم القومي)</CardDescription>
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
                        <Label>اسم الطالب الكامل *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={addStudent} disabled={adding} className="gap-2">
                        {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                        إضافة
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}

                {isSupervisor && (
                  <p className="text-xs text-muted-foreground self-center">
                    إنشاء حسابات الطلاب يتم بواسطة المسؤول العام فقط
                  </p>
                )}
              </div>

              {students.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    لا يوجد طلاب في هذا المقرر بعد
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border">
                      {students.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 px-5 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{s.full_name}</p>
                            <p className="text-xs font-mono text-muted-foreground" dir="ltr">{s.national_id}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isSupervisor && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditStudent(s)}
                                aria-label="تعديل الاسم"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeStudent(s.id)}
                              aria-label="إزالة من المقرر"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="groups" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={students.length === 0}>
                      <Plus className="h-4 w-4" />
                      مجموعة جديدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إنشاء مجموعة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>اسم المجموعة *</Label>
                        <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="مثال: المجموعة الأولى" />
                      </div>
                      <div className="space-y-2">
                        <Label>اختر الأعضاء *</Label>
                        <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                          {students.map((s) => (
                            <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                              <Checkbox
                                checked={groupMembers.includes(s.id)}
                                onCheckedChange={(v) =>
                                  setGroupMembers((prev) =>
                                    v ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                                  )
                                }
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{s.full_name}</p>
                                <p className="text-xs font-mono text-muted-foreground" dir="ltr">{s.national_id}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createGroup} disabled={creatingGroup} className="gap-2">
                        {creatingGroup && <Loader2 className="h-4 w-4 animate-spin" />}
                        إنشاء
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {groups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    لم تُنشأ مجموعات بعد
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g) => (
                    <Card key={g.id}>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">{g.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeGroup(g.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {g.member_ids.map((sid) => (
                            <Badge key={sid} variant="secondary" className="font-normal">
                              {studentName(sid)}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assignments">
              <Card>
                <CardContent className="py-8 text-center space-y-3">
                  <p className="text-muted-foreground">لإدارة طلبات التسليم لهذا المقرر</p>
                  <Link to={`${baseRoute}/assignments?course=${courseId}`}>
                    <Button>الذهاب لطلبات التسليم</Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
              <Button onClick={saveEditStudent} disabled={savingEdit} className="gap-2">
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

export default AdminCourseDetail;
