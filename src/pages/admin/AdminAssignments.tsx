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

interface Course { id: string; name: string }
interface Group { id: string; name: string; course_id: string }
interface Profile { id: string; full_name: string; national_id: string }
interface Assignment {
  id: string; course_id: string; title: string; description: string | null;
  due_date: string | null; scope: "course" | "group"; group_id: string | null;
  late_policy: "block" | "allow_marked_late"; created_at: string;
  grouping_mode?: "none" | "random" | "alphabetical" | "manual" | "student_self";
  gender_filter?: "male" | "female" | "any"; gender_split?: "mixed" | "separated";
  max_group_size?: number | null; group_submission_mode?: "per_student" | "one_per_group";
}
interface Submission {
  id: string; assignment_id: string; student_id: string; group_id?: string | null;
  file_path: string; file_name: string; status: "pending" | "approved" | "rejected" | "resubmit_requested";
  is_late: boolean; reviewer_notes: string | null; submitted_at: string;
  profiles: { full_name: string; national_id: string } | null;
}

const statusLabels = {
  pending: { label: "قيد المراجعة", variant: "secondary" as const },
  approved: { label: "مقبول", variant: "default" as const },
  rejected: { label: "مرفوض", variant: "destructive" as const },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline" as const },
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
    const subQ = supabase.from("submissions").select("*").order("submitted_at", { ascending: false });
    const enrQ = supabase.from("course_students").select("course_id, student_id");

    if (allowedCourseIds) {
      courseQ.in("id", allowedCourseIds);
      groupQ.in("course_id", allowedCourseIds);
      assignQ.in("course_id", allowedCourseIds);
      enrQ.in("course_id", allowedCourseIds);
    }

    const [{ data: cs }, { data: gs }, { data: ass }, { data: subs }, { data: enr }] = await Promise.all([ courseQ, groupQ, assignQ, subQ, enrQ ]);

    const studentIds = Array.from(new Set([
      ...((subs as any) ?? []).map((s: any) => s.student_id),
      ...((enr as any) ?? []).map((e: any) => e.student_id),
    ])) as string[];
    let profileMap = new Map<string, Profile>();
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, national_id").in("id", studentIds);
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p as Profile]));
    }

    const enrMap = new Map<string, Profile[]>();
    ((enr as any) ?? []).forEach((row: any) => {
      const p = profileMap.get(row.student_id);
      if (!p) return;
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
    setSubmissions(((subs as any) ?? []).map((s: any) => ({ ...s, profiles: profileMap.get(s.student_id) ?? null })));
    setEnrollments(enrMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [isSupervisor, currentUser?.id]);

  const courseGroups = groups.filter((g) => g.course_id === newCourse);
  const courseStudents = enrollments.get(newCourse) ?? [];

  const create = async () => {
    if (!newCourse) return toast.error("اختر المقرر");
    if (!title.trim()) return toast.error("العنوان مطلوب");
    if (scope === "group" && !groupId) return toast.error("اختر المجموعة");
    
    setCreating(true);
    let realScope: "course" | "group" = scope === "selected_students" ? "group" : (scope as any);
    let realGroupId: string | null = scope === "group" ? groupId : null;

    if (scope === "selected_students") {
      const { data: g, error: gErr } = await supabase.from("groups").insert({ course_id: newCourse, name: `${title.trim()} - مخصصة` }).select("id").single();
      if (gErr) { toast.error("تعذر إنشاء المجموعة"); setCreating(false); return; }
      const rows = selectedStudents.map((sid) => ({ group_id: (g as any).id, student_id: sid }));
      await supabase.from("group_members").insert(rows);
      realGroupId = (g as any).id;
    }

    const { error } = await supabase.from("assignments").insert({
      course_id: newCourse, title: title.trim(), description: desc.trim() || null,
      due_date: due ? new Date(due).toISOString() : null, scope: realScope, group_id: realGroupId,
      late_policy: latePol, grouping_mode: groupingMode, gender_filter: genderFilter,
      gender_split: genderSplit, max_group_size: maxGroupSize ? parseInt(maxGroupSize, 10) : null,
      group_submission_mode: groupingMode !== "none" ? submissionMode : "per_student",
    });
    
    if (error) toast.error(error.message);
    else {
      toast.success("تم إنشاء طلب التسليم");
      setOpen(false); setTitle(""); setDesc(""); setDue(""); load();
    }
    setCreating(false);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("حذف طلب التسليم وكل تسليماته؟")) return;
    const { data: subRows } = await supabase.from("submissions").select("file_path").eq("assignment_id", id);
    const paths = ((subRows as any) ?? []).map((s: any) => s.file_path).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
    await supabase.from("assignments").delete().eq("id", id);
    toast.success("تم الحذف"); load();
  };

  const updateSubmission = async (sid: string, status: Submission["status"], notes?: string) => {
    const { error } = await supabase.from("submissions").update({ status, reviewer_notes: notes ?? null, reviewed_at: new Date().toISOString() }).eq("id", sid);
    if (error) toast.error(error.message);
    else { toast.success("تم التحديث"); load(); }
  };

  const downloadOne = async (sub: Submission) => {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(sub.file_path, 600);
    if (data) {
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = `${sub.profiles?.national_id ?? "student"}_${sub.file_name}`; a.click();
    }
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
    const a = document.createElement("a"); a.href = url; a.download = "submissions.zip"; a.click();
  };

  const getAssignmentTargetStudents = async (a: Assignment): Promise<Profile[]> => {
    if (a.scope === "course") return enrollments.get(a.course_id) ?? [];
    if (a.scope === "group" && a.group_id) {
      const { data } = await supabase.from("group_members").select("student_id").eq("group_id", a.group_id);
      const ids = ((data as any) ?? []).map((r: any) => r.student_id);
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
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> طلب جديد</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>إنشاء طلب تسليم</DialogTitle></DialogHeader>
              {/* Form content same as before... */}
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>المقرر *</Label>
                  <Select value={newCourse} onValueChange={(v) => { setNewCourse(v); setGroupId(""); setSelectedStudents([]); }}>
                    <SelectTrigger><SelectValue placeholder="اختر مقرر" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
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
                  </div>
                  {groupingMode !== "none" && (
                    <>
                      <div className="space-y-2">
                        <Label>عدد الأعضاء في كل مجموعة</Label>
                        <Input type="number" min={1} value={maxGroupSize} onChange={(e) => setMaxGroupSize(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>طريقة التسليم لكل مجموعة</Label>
                        <Select value={submissionMode} onValueChange={(v: any) => setSubmissionMode(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_per_group">تسليم واحد لكل مجموعة (يرفع أحدهم ويعدله الجميع)</SelectItem>
                            <SelectItem value="per_student">كل طالب يسلّم نسخته الخاصة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <DialogFooter><Button onClick={create} disabled={creating}>{creating ? <Loader2 className="animate-spin" /> : "إنشاء"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground">لا توجد طلبات تسليم</p></CardContent></Card>
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
                          {a.scope === "group" && <Badge variant="secondary">مجموعة: {groupName(a.group_id)}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {a.due_date && <span>📅 {new Date(a.due_date).toLocaleString("ar-EG")}</span>}
                          <span>📥 {subs.length} ملف تم رفعه</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {subs.length > 0 && (
                          <Button variant="outline" size="sm" onClick={() => downloadAll(a.id)}><FolderArchive className="h-4 w-4 ml-1"/> تحميل الكل</Button>
                        )}
                        {a.grouping_mode && a.grouping_mode !== "none" && (
                          <Link to={`${baseRoute}/assignments/${a.id}/groups`}><Button variant="outline" size="sm"><Users2 className="h-4 w-4 ml-1"/> المجموعات</Button></Link>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setExpandedId(isOpen ? null : a.id)}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeAssignment(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="pt-0">
                      <RosterView assignment={a} submissions={subs} getTargets={() => getAssignmentTargetStudents(a)} onUpdate={updateSubmission} onDownload={downloadOne} />
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

// -------------------------------------------------------------
// RosterView - Handles Grouped viewing and Flat viewing
// -------------------------------------------------------------
function RosterView({ assignment, submissions, getTargets, onUpdate, onDownload }: any) {
  const [targets, setTargets] = useState<Profile[]>([]);
  const [aGroups, setAGroups] = useState<any[]>([]);
  const [aMembers, setAMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTargets().then(async (t: Profile[]) => {
      setTargets(t);
      if (assignment.grouping_mode !== "none") {
        const [{ data: grps }, { data: mems }] = await Promise.all([
          supabase.from("assignment_groups").select("*").eq("assignment_id", assignment.id),
          supabase.from("assignment_group_members").select("*").eq("assignment_id", assignment.id)
        ]);
        setAGroups(grps || []);
        setAMembers(mems || []);
      }
      setLoading(false);
    });
  }, [assignment.id]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (targets.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">لا يوجد طلاب مستهدفون</p>;

  const subByStudent = new Map<string, Submission>();
  submissions.forEach((s: Submission) => subByStudent.set(s.student_id, s));

  // Render for Group Assignments
  if (assignment.grouping_mode !== "none") {
    const isOnePerGroup = assignment.group_submission_mode === "one_per_group";
    const groupedStudentIds = new Set(aMembers.map(m => m.student_id));
    const ungroupedStudents = targets.filter(t => !groupedStudentIds.has(t.id));

    return (
      <div className="space-y-4 pt-2">
        {aGroups.map(group => {
          const groupMemberIds = aMembers.filter(m => m.group_id === group.id).map(m => m.student_id);
          const members = targets.filter(t => groupMemberIds.includes(t.id));
          const groupSub = isOnePerGroup ? submissions.find((s: Submission) => s.group_id === group.id) : null;
          
          return (
            <div key={group.id} className="border border-primary/20 rounded-lg overflow-hidden bg-muted/5">
              <div className="bg-primary/10 px-4 py-3 flex justify-between items-center flex-wrap gap-3">
                <div className="font-semibold text-primary">{group.name} <span className="text-xs text-muted-foreground">({members.length} أعضاء)</span></div>
                
                {/* Controls for the SINGLE GROUP SUBMISSION */}
                {isOnePerGroup && groupSub && (
                  <div className="flex items-center gap-2">
                    <Badge variant={statusLabels[groupSub.status as keyof typeof statusLabels].variant}>{statusLabels[groupSub.status as keyof typeof statusLabels].label}</Badge>
                    <Button variant="outline" size="sm" onClick={() => onDownload(groupSub)}><Download className="h-4 w-4 ml-1"/> الملف</Button>
                    <Button variant="ghost" size="icon" className="text-success" onClick={() => onUpdate(groupSub.id, "approved")}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onUpdate(groupSub.id, "rejected", prompt("سبب الرفض:") || "")}><X className="h-4 w-4" /></Button>
                  </div>
                )}
                {isOnePerGroup && !groupSub && <Badge variant="outline">لم يتم تسليم بحث المجموعة</Badge>}
              </div>
              
              {/* List members inside group */}
              <ul className="divide-y divide-border">
                {members.map(member => {
                  const mSub = subByStudent.get(member.id);
                  return (
                    <li key={member.id} className="px-4 py-2 flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{member.full_name}</span>
                        <span className="text-xs text-muted-foreground mr-2 font-mono" dir="ltr">{member.national_id}</span>
                      </div>
                      {/* If Individual submission inside group, show controls here */}
                      {!isOnePerGroup && (
                        <div className="flex items-center gap-2">
                          {mSub ? (
                            <>
                              <Badge variant={statusLabels[mSub.status as keyof typeof statusLabels].variant}>{statusLabels[mSub.status as keyof typeof statusLabels].label}</Badge>
                              <Button variant="ghost" size="icon" onClick={() => onDownload(mSub)}><Download className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-success" onClick={() => onUpdate(mSub.id, "approved")}><Check className="h-4 w-4" /></Button>
                            </>
                          ) : <span className="text-xs text-muted-foreground">لم يُسلم</span>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {ungroupedStudents.length > 0 && (
          <div className="border border-destructive/20 rounded-lg overflow-hidden bg-destructive/5">
            <div className="bg-destructive/10 px-4 py-3 font-semibold text-destructive">طلاب بدون مجموعة ({ungroupedStudents.length})</div>
            <ul className="divide-y divide-border p-3 text-sm text-muted-foreground">
              {ungroupedStudents.map(u => <li key={u.id} className="py-1">{u.full_name}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Render for Flat (Individual) Assignments
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
                </div>
                {s && <p className="text-xs text-muted-foreground mt-1">📎 {s.file_name}</p>}
              </div>
              {s && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onDownload(s)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-success" onClick={() => onUpdate(s.id, "approved")}><Check className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onUpdate(s.id, "rejected", prompt("سبب الرفض:") || "")}><X className="h-4 w-4" /></Button>
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
