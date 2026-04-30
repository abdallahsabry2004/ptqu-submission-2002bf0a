import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, FileText, Download, Check, X, RefreshCw, Trash2, ChevronDown, ChevronUp, FolderArchive, Users2, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { generateSubmissionsPdf } from "@/lib/pdfReport";

interface Course { id: string; name: string }
interface Group { id: string; name: string; course_id: string }
interface Profile { id: string; full_name: string; national_id: string }
interface Assignment {
  id: string; course_id: string; title: string; description: string | null; due_date: string | null;
  scope: "course" | "group"; group_id: string | null; late_policy: "block" | "allow_marked_late"; created_at: string;
  grouping_mode?: "none" | "random" | "alphabetical" | "manual" | "student_self"; gender_filter?: "male" | "female" | "any";
  gender_split?: "mixed" | "separated"; max_group_size?: number | null; group_submission_mode?: "per_student" | "one_per_group";
}
interface Submission {
  id: string; assignment_id: string; student_id: string; group_id?: string | null; file_path: string; file_name: string;
  status: "pending" | "approved" | "rejected" | "resubmit_requested"; is_late: boolean; reviewer_notes: string | null;
  submitted_at: string; profiles: { full_name: string; national_id: string } | null;
}

const statusLabels = {
  pending: { label: "قيد المراجعة", variant: "secondary" as const }, approved: { label: "مقبول", variant: "default" as const },
  rejected: { label: "مرفوض", variant: "destructive" as const }, resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline" as const },
};

const statusOf = (s?: Submission) => (s ? statusLabels[s.status] : { label: "لم يُسلَّم", variant: "outline" as const });

const AdminAssignments = () => {
  const { role, user: currentUser } = useAuth();
  const isSupervisor = role === "supervisor";
  const baseRoute = isSupervisor ? "/supervisor" : "/admin";
  const [params] = useSearchParams();
  const initialCourse = params.get("course") ?? "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, Profile[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState(initialCourse);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [newCourse, setNewCourse] = useState(initialCourse);
  const [scope, setScope] = useState<"course" | "group" | "selected_students">("course");
  const [groupId, setGroupId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [latePol, setLatePol] = useState<"block" | "allow_marked_late">("allow_marked_late");
  const [creating, setCreating] = useState(false);

  const [groupingMode, setGroupingMode] = useState<"none" | "random" | "alphabetical" | "manual" | "student_self">("none");
  const [genderFilter, setGenderFilter] = useState<"any" | "male" | "female">("any");
  const [genderSplit, setGenderSplit] = useState<"mixed" | "separated">("mixed");
  const [maxGroupSize, setMaxGroupSize] = useState<string>("");
  const [submissionMode, setSubmissionMode] = useState<"per_student" | "one_per_group">("per_student");

    const load = async () => {
    setLoading(true);
    let allowedCourseIds: string[] | null = null;
    if (isSupervisor && currentUser) {
      const { data: links } = await supabase.from("course_supervisors").select("course_id").eq("supervisor_id", currentUser.id);
      allowedCourseIds = ((links as any) ?? []).map((l: any) => l.course_id);
      if (allowedCourseIds!.length === 0) {
        setCourses([]); setGroups([]); setAssignments([]); setSubmissions([]); setEnrollments(new Map());
        setLoading(false); return;
      }
    }

    const courseQ = supabase.from("courses").select("id, name").order("name");
    const groupQ = supabase.from("groups").select("id, name, course_id");
    const assignQ = supabase.from("assignments").select("*").order("created_at", { ascending: false });
    const subQ = supabase.from("submissions").select("*, profiles(full_name, national_id)").order("submitted_at", { ascending: false });
    
    // جلب الطلاب المسجلين (بدون دمج مباشر لتجنب أخطاء الربط)
    const enrQ = supabase.from("course_students").select("course_id, student_id");

    if (allowedCourseIds) {
      courseQ.in("id", allowedCourseIds); groupQ.in("course_id", allowedCourseIds); assignQ.in("course_id", allowedCourseIds); enrQ.in("course_id", allowedCourseIds);
    }

    const [{ data: cs }, { data: gs }, { data: ass }, { data: subs }, { data: enrData }] = await Promise.all([courseQ, groupQ, assignQ, subQ, enrQ]);

    // الطريقة المضمونة: تجميع أرقام الطلاب ثم جلب بياناتهم
    const studentIds = Array.from(new Set([
      ...((subs as any) ?? []).map((s: any) => s.student_id),
      ...((enrData as any) ?? []).map((e: any) => e.student_id),
    ])) as string[];

    let profileMap = new Map<string, Profile>();
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, national_id").in("id", studentIds);
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p as Profile]));
    }

    const enrMap = new Map<string, Profile[]>();
    ((enrData as any) ?? []).forEach((row: any) => {
      const p = profileMap.get(row.student_id);
      if (!p) return; // الآن لن يتم تجاهل أحد لأن البيانات موجودة
      const list = enrMap.get(row.course_id) ?? [];
      list.push(p);
      enrMap.set(row.course_id, list);
    });
    
    enrMap.forEach((list, k) => {
      list.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
      enrMap.set(k, list);
    });

    setCourses((cs as any) ?? []);
    setGroups((gs as any) ?? []);
    setAssignments((ass as any) ?? []);
    setSubmissions((subs as any) ?? []);
    setEnrollments(enrMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [isSupervisor, currentUser?.id]);

  const courseGroups = groups.filter((g) => g.course_id === newCourse);
  const courseStudents = newCourse ? (enrollments.get(newCourse) ?? []) : [];

  const create = async () => {
    if (!newCourse) return toast.error("اختر المقرر");
    if (!title.trim()) return toast.error("العنوان مطلوب");
    if (scope === "group" && !groupId) return toast.error("اختر المجموعة");
    if (scope === "selected_students" && selectedStudents.length === 0) return toast.error("اختر طالب واحد على الأقل");

    setCreating(true);
    let realScope: "course" | "group" = scope === "selected_students" ? "group" : (scope as any);
    let realGroupId: string | null = scope === "group" ? groupId : null;

    if (scope === "selected_students") {
      const { data: g, error: gErr } = await supabase.from("groups").insert({ course_id: newCourse, name: `${title.trim()} - مجموعة مخصصة` }).select("id").single();
      if (gErr || !g) { toast.error(gErr?.message ?? "تعذر إنشاء المجموعة"); setCreating(false); return; }
      const rows = selectedStudents.map((sid) => ({ group_id: (g as any).id, student_id: sid }));
      const { error: mErr } = await supabase.from("group_members").insert(rows);
      if (mErr) { toast.error(mErr.message); setCreating(false); return; }
      realGroupId = (g as any).id;
    }

    const { error } = await supabase.from("assignments").insert({
      course_id: newCourse, title: title.trim(), description: desc.trim() || null, due_date: due ? new Date(due).toISOString() : null,
      scope: realScope, group_id: realGroupId, late_policy: latePol, grouping_mode: groupingMode, gender_filter: genderFilter,
      gender_split: genderSplit, max_group_size: maxGroupSize ? Math.max(1, parseInt(maxGroupSize, 10)) : null,
      group_submission_mode: groupingMode !== "none" ? submissionMode : "per_student",
    });
    
    if (error) toast.error(error.message);
    else {
      toast.success("تم إنشاء طلب التسليم");
      setOpen(false); setTitle(""); setDesc(""); setDue(""); setGroupId(""); setSelectedStudents([]);
      setGroupingMode("none"); setGenderFilter("any"); setMaxGroupSize(""); setGenderSplit("mixed"); setSubmissionMode("per_student");
      load();
    }
    setCreating(false);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف طلب التسليم وكل تسليماته؟")) return;
    const { data: subRows } = await supabase.from("submissions").select("file_path").eq("assignment_id", id);
    const paths = ((subRows as any) ?? []).map((s: any) => s.file_path).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف بنجاح"); load(); }
  };

  const updateSubmission = async (sid: string, status: Submission["status"], notes?: string) => {
    const { error } = await supabase.from("submissions").update({ status, reviewer_notes: notes ?? null, reviewed_at: new Date().toISOString() }).eq("id", sid);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الحالة"); load(); }
  };

  const downloadOne = async (sub: Submission) => {
    const { data, error } = await supabase.storage.from("submissions").createSignedUrl(sub.file_path, 600);
    if (error || !data) return toast.error("فشل تحميل الملف");
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = `${sub.profiles?.national_id ?? "student"}_${sub.file_name}`; a.click();
  };

  const downloadAll = async (assignmentId: string) => {
    const subs = submissions.filter((s) => s.assignment_id === assignmentId);
    if (subs.length === 0) return toast.error("لا توجد تسليمات لتحميلها");
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
    a.href = url; a.download = `${(ass?.title ?? "assignment").replace(/[\\/:*?"<>|]/g, "_")}.zip`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التحميل بنجاح");
  };

  const downloadPdfReport = async (a: Assignment) => {
    const targetStudents = await getAssignmentTargetStudents(a);
    const subsByStudent = new Map<string, Submission>();
    submissions.filter((s) => s.assignment_id === a.id).forEach((s) => { subsByStudent.set(s.student_id, s); });
    
    // جلب بيانات المجموعات لإضافتها للتقرير إذا كان التكليف بنظام المجموعات
    let groupMap = new Map<string, string>();
    if (a.grouping_mode !== "none") {
      const { data: gData } = await supabase.from("assignment_groups").select("id, name").eq("assignment_id", a.id);
      const { data: gmData } = await supabase.from("assignment_group_members").select("group_id, student_id").eq("assignment_id", a.id);
      const gNames = new Map((gData || []).map((g: any) => [g.id, g.name]));
      (gmData || []).forEach((gm: any) => { groupMap.set(gm.student_id, gNames.get(gm.group_id) || ""); });
    }

    const rows = targetStudents.map((p) => {
      const s = subsByStudent.get(p.id);
      return {
        national_id: p.national_id,
        full_name: p.full_name,
        group_name: groupMap.get(p.id),
        status_label: statusOf(s).label,
        is_late: !!s?.is_late,
        submitted_at: s?.submitted_at ?? null,
        reviewer_notes: s?.reviewer_notes ?? null,
      };
    });
    
    const blob = await generateSubmissionsPdf({
      title: a.title, course_name: courseName(a.course_id),
      due_date: a.due_date ? new Date(a.due_date).toLocaleString("ar-EG") : null,
      generated_at: new Date().toLocaleString("ar-EG"),
    }, rows);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${a.title.replace(/[\\/:*?"<>|]/g, "_")}.pdf`; link.click();
    URL.revokeObjectURL(url);
  };

  const getAssignmentTargetStudents = async (a: Assignment): Promise<Profile[]> => {
    if (a.scope === "course") return enrollments.get(a.course_id) ?? [];
    if (a.scope === "group" && a.group_id) {
      const { data } = await supabase.from("group_members").select("student_id").eq("group_id", a.group_id);
      const ids = ((data as any) ?? []).map((r: any) => r.student_id) as string[];
      return (enrollments.get(a.course_id) ?? []).filter((p) => ids.includes(p.id));
    }
    return [];
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
              <Button className="gap-2" disabled={courses.length === 0}><Plus className="h-4 w-4" /> طلب جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>إنشاء طلب تسليم</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>المقرر *</Label>
                  <Select value={newCourse} onValueChange={(v) => { setNewCourse(v); setGroupId(""); setSelectedStudents([]); }}>
                    <SelectTrigger><SelectValue placeholder="اختر مقرر" /></SelectTrigger>
                    <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>عنوان البحث/الأسايمنت *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: بحث عن مناهج البحث الكمي" />
                </div>
                <div className="space-y-2">
                  <Label>وصف وتفاصيل المطلوب</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="اكتب التفاصيل..." />
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
                      <SelectItem value="group">مجموعة جاهزة في المقرر</SelectItem>
                      <SelectItem value="selected_students">طلاب محددون فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scope === "group" && (
                  <div className="space-y-2">
                    <Label>المجموعة *</Label>
                    <Select value={groupId} onValueChange={setGroupId} disabled={courseGroups.length === 0}>
                      <SelectTrigger><SelectValue placeholder={courseGroups.length === 0 ? "لا توجد مجموعات في المقرر" : "اختر مجموعة"} /></SelectTrigger>
                      <SelectContent>{courseGroups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                {scope === "selected_students" && (
                  <div className="space-y-2">
                    <Label>اختر الطلاب من قائمة المقرر *</Label>
                    {courseStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground border rounded-lg p-3">لا يوجد طلاب مسجلون في هذا المقرر</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>تم الاختيار: {selectedStudents.length} / {courseStudents.length}</span>
                          <button type="button" className="text-primary hover:underline" onClick={() => setSelectedStudents(selectedStudents.length === courseStudents.length ? [] : courseStudents.map((s) => s.id))}>
                            {selectedStudents.length === courseStudents.length ? "إلغاء الكل" : "اختر الكل"}
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                          {courseStudents.map((s) => (
                            <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                              <Checkbox checked={selectedStudents.includes(s.id)} onCheckedChange={(v) => setSelectedStudents((prev) => v ? [...prev, s.id] : prev.filter((x) => x !== s.id))} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{s.full_name}</p>
                                <p className="text-xs font-mono text-muted-foreground" dir="ltr">{s.national_id}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
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
                    {groupingMode !== "none" && (
                      <div className="space-y-2">
                        <Label>تنظيم النوع داخل المجموعات</Label>
                        <Select
                          value={genderFilter === "male" ? "male_only" : genderFilter === "female" ? "female_only" : genderSplit === "separated" ? "separated" : "mixed"}
                          onValueChange={(v: any) => {
                            if (v === "male_only") { setGenderFilter("male"); setGenderSplit("mixed"); }
                            else if (v === "female_only") { setGenderFilter("female"); setGenderSplit("mixed"); }
                            else if (v === "separated") { setGenderFilter("any"); setGenderSplit("separated"); }
                            else { setGenderFilter("any"); setGenderSplit("mixed"); }
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mixed">قائمة مدمجة (يسمح لكلا النوعين في نفس المجموعة)</SelectItem>
                            <SelectItem value="separated">قائمة مفصولة (عزل ذكور وإناث تماماً)</SelectItem>
                            <SelectItem value="male_only">ذكور فقط</SelectItem>
                            <SelectItem value="female_only">إناث فقط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {groupingMode !== "none" && (
                    <>
                      <div className="space-y-2">
                        <Label>عدد الأعضاء في كل مجموعة</Label>
                        <Input type="number" min={1} value={maxGroupSize} onChange={(e) => setMaxGroupSize(e.target.value)} placeholder="مثال: 5" />
                      </div>
                      <div className="space-y-2">
                        <Label>طريقة التسليم لكل مجموعة</Label>
                        <Select value={submissionMode} onValueChange={(v: any) => setSubmissionMode(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_per_group">تسليم واحد لكل مجموعة (يرفع أحدهم ويعدله الجميع)</SelectItem>
                            <SelectItem value="per_student">كل طالب يسلّم نسخته الخاصة داخل مجموعته</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm">تصفية بالمقرر:</Label>
          <Select value={filterCourse || "all"} onValueChange={(v) => setFilterCourse(v === "all" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="كل المقررات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المقررات</SelectItem>
              {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">لا توجد طلبات تسليم</p></CardContent></Card>
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
                          {a.scope === "group" && (<Badge variant="secondary">مجموعة: {groupName(a.group_id)}</Badge>)}
                        </div>
                        {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {a.due_date && <span>📅 {new Date(a.due_date).toLocaleString("ar-EG")}</span>}
                          <span>📥 {subs.length} تسليم</span>
                          {pending > 0 && <Badge variant="secondary" className="gap-1">{pending} قيد المراجعة</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadPdfReport(a)}><FileBarChart className="h-4 w-4" /> تقرير PDF</Button>
                        {subs.length > 0 && (<Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadAll(a.id)}><FolderArchive className="h-4 w-4" /> تحميل الكل</Button>)}
                        {a.grouping_mode && a.grouping_mode !== "none" && (<Link to={`${baseRoute}/assignments/${a.id}/groups`}><Button variant="outline" size="sm" className="gap-1.5"><Users2 className="h-4 w-4" /> المجموعات</Button></Link>)}
                        <Button variant="ghost" size="icon" onClick={() => setExpandedId(isOpen ? null : a.id)}>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeAssignment(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isOpen && (<CardContent className="pt-0"><RosterView assignment={a} submissions={subs} getTargets={() => getAssignmentTargetStudents(a)} onUpdate={updateSubmission} onDownload={downloadOne} /></CardContent>)}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function RosterView({ assignment, submissions, getTargets, onUpdate, onDownload }: any) {
  const [targets, setTargets] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { setLoading(true); getTargets().then((t: any) => { setTargets(t); setLoading(false); }); }, [assignment.id]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (targets.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">لا يوجد طلاب مستهدفون</p>;

  const subByStudent = new Map<string, Submission>();
  submissions.forEach((s: any) => subByStudent.set(s.student_id, s));

  return (
    <ul className="divide-y divide-border border rounded-lg overflow-hidden">
      {targets.map((p) => {
        const s = subByStudent.get(p.id);
        const sl = s ? statusLabels[s.status as keyof typeof statusLabels] : { label: "لم يُسلَّم", variant: "outline" as const };
        return (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{p.full_name}</p>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">{p.national_id}</span>
                  <Badge variant={sl.variant as any}>{sl.label}</Badge>
                  {s?.is_late && <Badge variant="destructive" className="text-xs">متأخر</Badge>}
                </div>
                {s ? (<p className="text-xs text-muted-foreground mt-1">📎 {s.file_name} · {new Date(s.submitted_at).toLocaleString("ar-EG")}</p>) : (<p className="text-xs text-muted-foreground mt-1">لم يقم الطالب برفع ملف بعد</p>)}
              </div>
              {s && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="تحميل" onClick={() => onDownload(s)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="قبول" className="text-success hover:bg-success/10" onClick={() => onUpdate(s.id, "approved")}><Check className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="رفض" className="text-destructive hover:bg-destructive/10" onClick={() => { const note = prompt("سبب الرفض (اختياري):") ?? undefined; onUpdate(s.id, "rejected", note); }}><X className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="طلب إعادة تسليم" className="text-warning hover:bg-warning/10" onClick={() => { const note = prompt("ملاحظات إعادة التسليم:") ?? undefined; onUpdate(s.id, "resubmit_requested", note); }}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default AdminAssignments;
