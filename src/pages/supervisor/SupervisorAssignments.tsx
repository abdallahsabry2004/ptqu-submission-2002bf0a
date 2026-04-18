import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  FileText,
  Download,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;
}
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

const SupervisorAssignments = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initialCourse = params.get("course") ?? "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState(initialCourse);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // create dialog
  const [open, setOpen] = useState(false);
  const [newCourse, setNewCourse] = useState(initialCourse);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [latePol, setLatePol] = useState<"block" | "allow_marked_late">("allow_marked_late");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: links } = await supabase
      .from("course_supervisors")
      .select("course_id")
      .eq("supervisor_id", user.id);
    const courseIds = (links ?? []).map((l: any) => l.course_id);

    if (courseIds.length === 0) {
      setCourses([]);
      setAssignments([]);
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const [{ data: cs }, { data: ass }] = await Promise.all([
      supabase.from("courses").select("id, name").in("id", courseIds).order("name"),
      supabase
        .from("assignments")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false }),
    ]);

    const assignmentIds = (ass ?? []).map((a: any) => a.id);
    let subs: any[] = [];
    if (assignmentIds.length > 0) {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false });
      subs = data ?? [];
    }
    const studentIds = Array.from(new Set(subs.map((s: any) => s.student_id))) as string[];
    let profileMap = new Map<string, { full_name: string; national_id: string }>();
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, national_id")
        .in("id", studentIds);
      profileMap = new Map(
        (profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, national_id: p.national_id }])
      );
    }

    setCourses((cs as any) ?? []);
    setAssignments((ass as any) ?? []);
    setSubmissions(
      subs.map((s: any) => ({ ...s, profiles: profileMap.get(s.student_id) ?? null }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const filteredAssignments = useMemo(
    () => (filterCourse ? assignments.filter((a) => a.course_id === filterCourse) : assignments),
    [assignments, filterCourse]
  );

  const create = async () => {
    if (!newCourse) {
      toast.error("اختر المقرر");
      return;
    }
    if (!title.trim()) {
      toast.error("عنوان طلب التسليم مطلوب");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("assignments").insert({
      course_id: newCourse,
      title: title.trim(),
      description: desc.trim() || null,
      due_date: due ? new Date(due).toISOString() : null,
      late_policy: latePol,
      scope: "course",
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إنشاء طلب التسليم");
      setOpen(false);
      setTitle("");
      setDesc("");
      setDue("");
      load();
    }
    setCreating(false);
  };

  const review = async (id: string, status: Submission["status"], notes?: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ status, reviewer_notes: notes ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم تحديث الحالة");
      load();
    }
  };

  const downloadFile = async (sub: Submission) => {
    const { data, error } = await supabase.storage
      .from("submissions")
      .createSignedUrl(sub.file_path, 60);
    if (error || !data) {
      toast.error("تعذر تحميل الملف");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = sub.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">طلبات التسليم</h1>
            <p className="text-muted-foreground">إنشاء ومراجعة تسليمات مقرراتك</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={courses.length === 0}>
                <Plus className="h-4 w-4" />
                طلب تسليم جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء طلب تسليم</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>المقرر *</Label>
                  <Select value={newCourse} onValueChange={setNewCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المقرر" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>العنوان *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>الموعد النهائي (اختياري)</Label>
                  <Input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>سياسة التأخير</Label>
                  <Select value={latePol} onValueChange={(v: any) => setLatePol(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow_marked_late">السماح ووضع علامة تأخير</SelectItem>
                      <SelectItem value="block">منع التسليم بعد الموعد</SelectItem>
                    </SelectContent>
                  </Select>
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

        <div className="max-w-xs">
          <Select value={filterCourse || "_all"} onValueChange={(v) => setFilterCourse(v === "_all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="كل المقررات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">كل المقررات</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لا توجد طلبات تسليم</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((a) => {
              const subs = submissions.filter((s) => s.assignment_id === a.id);
              const expanded = expandedId === a.id;
              return (
                <Card key={a.id}>
                  <CardHeader
                    className="cursor-pointer flex flex-row items-center justify-between"
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                  >
                    <div>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {courseName(a.course_id)} · {subs.length} تسليم
                      </p>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardHeader>
                  {expanded && (
                    <CardContent className="space-y-3">
                      {subs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          لا توجد تسليمات بعد
                        </p>
                      ) : (
                        subs.map((s) => (
                          <SubmissionItem
                            key={s.id}
                            sub={s}
                            onDownload={() => downloadFile(s)}
                            onReview={(status, notes) => review(s.id, status, notes)}
                          />
                        ))
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

function SubmissionItem({
  sub,
  onDownload,
  onReview,
}: {
  sub: Submission;
  onDownload: () => void;
  onReview: (status: Submission["status"], notes?: string) => void;
}) {
  const [notes, setNotes] = useState(sub.reviewer_notes ?? "");
  const meta = statusLabels[sub.status];
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">{sub.profiles?.full_name ?? "—"}</p>
          <p className="text-xs font-mono text-muted-foreground" dir="ltr">
            {sub.profiles?.national_id ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {sub.is_late && <Badge variant="outline">متأخر</Badge>}
          <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            تحميل
          </Button>
        </div>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظات للطالب (اختياري)"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onReview("approved", notes)} className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          قبول
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onReview("rejected", notes)}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          رفض
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReview("resubmit_requested", notes)}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          طلب إعادة
        </Button>
      </div>
    </div>
  );
}

export default SupervisorAssignments;
