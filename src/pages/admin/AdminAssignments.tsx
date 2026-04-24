import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, FileText, Download, Check, X, RefreshCw, Trash2, ChevronDown, ChevronUp, FolderArchive, Users2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Link } from "react-router-dom";

interface Course { id: string; name: string }
interface Group { id: string; name: string; course_id: string }
interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  scope: "course" | "group";
  group_id: string | null;
  late_policy: "block" | "allow_marked_late";
  created_at: string;
  grouping_mode?: "none" | "random" | "alphabetical" | "manual" | "student_self";
  gender_filter?: "male" | "female" | "any";
  max_group_size?: number | null;
}
interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string;
  file_name: string;
  status: "pending" | "approved" | "rejected" | "resubmit_requested";
  is_late: boolean;
  reviewer_notes: string | null;
  submitted_at: string;
  profiles: { full_name: string; national_id: string } | null;
}

const statusLabels = {
  pending: { label: "قيد المراجعة", variant: "secondary" as const },
  approved: { label: "مقبول", variant: "default" as const },
  rejected: { label: "مرفوض", variant: "destructive" as const },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline" as const },
};

const AdminAssignments = () => {
  const [params] = useSearchParams();
  const initialCourse = params.get("course") ?? "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState(initialCourse);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // create dialog
  const [open, setOpen] = useState(false);
  const [newCourse, setNewCourse] = useState(initialCourse);
  const [scope, setScope] = useState<"course" | "group">("course");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [latePol, setLatePol] = useState<"block" | "allow_marked_late">("allow_marked_late");
  const [creating, setCreating] = useState(false);

  // grouping options
  const [groupingMode, setGroupingMode] = useState<"none" | "random" | "alphabetical" | "manual" | "student_self">("none");
  const [genderFilter, setGenderFilter] = useState<"any" | "male" | "female">("any");
  const [maxGroupSize, setMaxGroupSize] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: cs }, { data: gs }, { data: ass }, { data: subs }] = await Promise.all([
      supabase.from("courses").select("id, name").order("name"),
      supabase.from("groups").select("id, name, course_id"),
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*").order("submitted_at", { ascending: false }),
    ]);

    // Fetch student profiles separately and merge (avoids embed FK requirement)
    const studentIds = Array.from(new Set(((subs as any) ?? []).map((s: any) => s.student_id))) as string[];
    let profileMap = new Map<string, { full_name: string; national_id: string }>();
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, national_id")
        .in("id", studentIds);
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, national_id: p.national_id }]));
    }

    setCourses((cs as any) ?? []);
    setGroups((gs as any) ?? []);
    setAssignments((ass as any) ?? []);
    setSubmissions(
      ((subs as any) ?? []).map((s: any) => ({
        ...s,
        profiles: profileMap.get(s.student_id) ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const courseGroups = groups.filter((g) => g.course_id === newCourse);

  const create = async () => {
    if (!newCourse) return toast.error("اختر المقرر");
    if (!title.trim()) return toast.error("العنوان مطلوب");
    if (scope === "group" && !groupId) return toast.error("اختر المجموعة");

    setCreating(true);
    const { error } = await supabase.from("assignments").insert({
      course_id: newCourse,
      title: title.trim(),
      description: desc.trim() || null,
      due_date: due ? new Date(due).toISOString() : null,
      scope,
      group_id: scope === "group" ? groupId : null,
      late_policy: latePol,
      grouping_mode: groupingMode,
      gender_filter: genderFilter,
      max_group_size: maxGroupSize ? Math.max(1, parseInt(maxGroupSize, 10)) : null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إنشاء طلب التسليم");
      setOpen(false);
      setTitle("");
      setDesc("");
      setDue("");
      setGroupId("");
      setGroupingMode("none");
      setGenderFilter("any");
      setMaxGroupSize("");
      load();
    }
    setCreating(false);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("حذف طلب التسليم وكل تسليماته؟")) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const updateSubmission = async (sid: string, status: Submission["status"], notes?: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({
        status,
        reviewer_notes: notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", sid);
    if (error) toast.error(error.message);
    else {
      toast.success("تم تحديث الحالة");
      load();
    }
  };

  const downloadOne = async (sub: Submission) => {
    const { data, error } = await supabase.storage.from("submissions").createSignedUrl(sub.file_path, 600);
    if (error || !data) {
      toast.error("فشل تحميل الملف");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `${sub.profiles?.national_id ?? "student"}_${sub.file_name}`;
    a.click();
  };

  const downloadAll = async (assignmentId: string) => {
    const subs = submissions.filter((s) => s.assignment_id === assignmentId);
    if (subs.length === 0) return toast.error("لا توجد تسليمات");
    toast.info(`جاري تجميع ${subs.length} ملف...`);
    const zip = new JSZip();
    for (const s of subs) {
      const { data } = await supabase.storage.from("submissions").download(s.file_path);
      if (data) {
        const folder = `${s.profiles?.national_id ?? s.student_id}_${(s.profiles?.full_name ?? "").replace(/[\\/:*?"<>|]/g, "")}`;
        zip.file(`${folder}/${s.file_name}`, data);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ass = assignments.find((x) => x.id === assignmentId);
    a.href = url;
    a.download = `${(ass?.title ?? "assignment").replace(/[\\/:*?"<>|]/g, "_")}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التحميل");
  };

  const filtered = useMemo(() => {
    if (!filterCourse) return assignments;
    return assignments.filter((a) => a.course_id === filterCourse);
  }, [assignments, filterCourse]);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";
  const groupName = (id: string | null) => (id ? groups.find((g) => g.id === id)?.name ?? "—" : "");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold">طلبات التسليم</h1>
            <p className="text-muted-foreground">إنشاء وإدارة طلبات التسليم ومراجعة الأبحاث</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={courses.length === 0}>
                <Plus className="h-4 w-4" />
                طلب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>إنشاء طلب تسليم</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>المقرر *</Label>
                  <Select value={newCourse} onValueChange={(v) => { setNewCourse(v); setGroupId(""); }}>
                    <SelectTrigger><SelectValue placeholder="اختر مقرر" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>عنوان البحث/الأسايمنت *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: بحث عن مناهج البحث الكمي" />
                </div>
                <div className="space-y-2">
                  <Label>وصف وتفاصيل المطلوب</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="اكتب التفاصيل، عدد الصفحات، التنسيق المطلوب..." />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الموعد النهائي (اختياري)</Label>
                    <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>سياسة التأخير</Label>
                    <Select value={latePol} onValueChange={(v: any) => setLatePol(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow_marked_late">السماح مع التمييز كمتأخر</SelectItem>
                        <SelectItem value="block">منع التسليم بعد الموعد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>نطاق التسليم *</Label>
                  <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">كل طلاب المقرر</SelectItem>
                      <SelectItem value="group">مجموعة محددة فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scope === "group" && (
                  <div className="space-y-2">
                    <Label>المجموعة *</Label>
                    <Select value={groupId} onValueChange={setGroupId} disabled={courseGroups.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={courseGroups.length === 0 ? "لا توجد مجموعات في المقرر" : "اختر مجموعة"} />
                      </SelectTrigger>
                      <SelectContent>
                        {courseGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-semibold">تقسيم المجموعات (اختياري)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>طريقة التقسيم</Label>
                      <Select value={groupingMode} onValueChange={(v: any) => setGroupingMode(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بدون تقسيم</SelectItem>
                          <SelectItem value="random">عشوائي</SelectItem>
                          <SelectItem value="alphabetical">أبجدي</SelectItem>
                          <SelectItem value="manual">يدوي بواسطة المسؤول</SelectItem>
                          <SelectItem value="student_self">يختار الطلاب مجموعاتهم</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>تصفية حسب الجنس</Label>
                      <Select value={genderFilter} onValueChange={(v: any) => setGenderFilter(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">الجميع (مختلط)</SelectItem>
                          <SelectItem value="male">ذكور فقط</SelectItem>
                          <SelectItem value="female">إناث فقط</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {groupingMode !== "none" && (
                    <div className="space-y-2">
                      <Label>عدد الأعضاء في كل مجموعة</Label>
                      <Input
                        type="number"
                        min={1}
                        value={maxGroupSize}
                        onChange={(e) => setMaxGroupSize(e.target.value)}
                        placeholder="مثال: 5"
                      />
                      <p className="text-xs text-muted-foreground">سيتم استخدام هذا العدد كحد أقصى لكل مجموعة. بعد إنشاء الطلب اضغط "إدارة المجموعات" لتنفيذ التقسيم.</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  إنشاء
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm">تصفية بالمقرر:</Label>
          <Select value={filterCourse || "all"} onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="كل المقررات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المقررات</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لا توجد طلبات تسليم</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const subs = submissions.filter((s) => s.assignment_id === a.id);
              const pending = subs.filter((s) => s.status === "pending").length;
              const isOpen = expandedId === a.id;
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <CardTitle className="text-lg">{a.title}</CardTitle>
                          <Badge variant="outline">{courseName(a.course_id)}</Badge>
                          {a.scope === "group" && (
                            <Badge variant="secondary">مجموعة: {groupName(a.group_id)}</Badge>
                          )}
                        </div>
                        {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {a.due_date && <span>📅 {new Date(a.due_date).toLocaleString("ar-EG")}</span>}
                          <span>📥 {subs.length} تسليم</span>
                          {pending > 0 && <Badge variant="secondary" className="gap-1">{pending} قيد المراجعة</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {subs.length > 0 && (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadAll(a.id)}>
                            <FolderArchive className="h-4 w-4" />
                            تحميل الكل
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setExpandedId(isOpen ? null : a.id)}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeAssignment(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="pt-0">
                      {subs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">لم يسلّم أحد بعد</p>
                      ) : (
                        <ul className="divide-y divide-border border rounded-lg overflow-hidden">
                          {subs.map((s) => {
                            const sl = statusLabels[s.status];
                            return (
                              <li key={s.id} className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold">{s.profiles?.full_name}</p>
                                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">{s.profiles?.national_id}</span>
                                      <Badge variant={sl.variant}>{sl.label}</Badge>
                                      {s.is_late && <Badge variant="destructive" className="text-xs">متأخر</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      📎 {s.file_name} · {new Date(s.submitted_at).toLocaleString("ar-EG")}
                                    </p>
                                    {s.reviewer_notes && (
                                      <p className="text-xs text-muted-foreground mt-1">💬 {s.reviewer_notes}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" title="تحميل" onClick={() => downloadOne(s)}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="قبول"
                                      className="text-success hover:bg-success/10"
                                      onClick={() => updateSubmission(s.id, "approved")}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="رفض"
                                      className="text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        const note = prompt("سبب الرفض (اختياري):") ?? undefined;
                                        updateSubmission(s.id, "rejected", note);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="طلب إعادة تسليم"
                                      className="text-warning hover:bg-warning/10"
                                      onClick={() => {
                                        const note = prompt("ملاحظات إعادة التسليم:") ?? undefined;
                                        updateSubmission(s.id, "resubmit_requested", note);
                                      }}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminAssignments;
