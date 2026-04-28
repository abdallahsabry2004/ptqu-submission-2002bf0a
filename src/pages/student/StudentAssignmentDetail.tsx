import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Upload, Download, Trash2, AlertCircle, CheckCircle2, Users2, FileText } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; variant: any; icon: any; color: string }> = {
  pending: { label: "قيد المراجعة", variant: "secondary", icon: Loader2, color: "text-muted-foreground" },
  approved: { label: "مقبول", variant: "default", icon: CheckCircle2, color: "text-success" },
  rejected: { label: "مرفوض — أعد التسليم", variant: "destructive", icon: AlertCircle, color: "text-destructive" },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline", icon: AlertCircle, color: "text-warning" },
};

const StudentAssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [myGroup, setMyGroup] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    
    // 1. Fetch assignment details
    const { data: a } = await supabase.from("assignments").select("*, courses(id, name)").eq("id", id).single();
    setAssignment(a);
    setCourse((a as any)?.courses);

    if (!a) { setLoading(false); return; }

    let currentGroup = null;

    // 2. If assignment requires groups, fetch my group and its members
    if (a.grouping_mode !== "none") {
      const { data: gMem } = await supabase.from("assignment_group_members")
        .select("group_id, assignment_groups(id, name)")
        .eq("assignment_id", id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (gMem) {
        currentGroup = { id: gMem.group_id, name: (gMem.assignment_groups as any).name };
        setMyGroup(currentGroup);

        const { data: gms } = await supabase.from("assignment_group_members")
          .select("student_id, profiles(id, full_name, national_id)")
          .eq("group_id", currentGroup.id);
        setGroupMembers((gms || []).map((m:any) => m.profiles));

        // Fetch all submissions for this group
        const { data: gSubs } = await supabase.from("submissions")
          .select("*")
          .eq("assignment_id", id)
          .eq("group_id", currentGroup.id);
        setAllSubs(gSubs || []);
      } else {
        setMyGroup(null);
        setAllSubs([]);
      }
    } else {
      // Individual assignment
      const { data: mSub } = await supabase.from("submissions")
        .select("*")
        .eq("assignment_id", id)
        .eq("student_id", user.id);
      setAllSubs(mSub || []);
    }
    
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  const isOverdue = assignment?.due_date && new Date(assignment.due_date) < new Date();
  const blocked = isOverdue && assignment?.late_policy === "block";

  // Check modes
  const isGroupMode = assignment?.grouping_mode !== "none";
  const isOnePerGroup = isGroupMode && assignment?.group_submission_mode === "one_per_group";

  // Find the submission I can edit
  const mySubmission = isOnePerGroup 
    ? allSubs[0] // If one per group, there is only one submission for the whole group
    : allSubs.find(s => s.student_id === user?.id); // If individual, find mine

  const handleUpload = async (file: File) => {
    if (!user || !assignment) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("الحد الأقصى للملف 50 ميجا");
      return;
    }
    setUploading(true);

    const safe = file.name.replace(/[^\w.\-آ-ي]/g, "_");
    const path = `${user.id}/${assignment.id}/${Date.now()}_${safe}`;

    // حذف الملف القديم من مساحة التخزين إن وجد
    if (mySubmission?.file_path) {
      await supabase.storage.from("submissions").remove([mySubmission.file_path]).catch(() => {});
    }

    const { error: upErr } = await supabase.storage
      .from("submissions")
      .upload(path, file, { upsert: false, contentType: file.type });
      
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }

    let dbErr;
    
    // === التعديل الجذري هنا ===
    if (mySubmission) {
      // بدلاً من التحديث (الذي تمنعه قاعدة البيانات)، نقوم بحذف السجل القديم
      await supabase.from("submissions").delete().eq("id", mySubmission.id);
    }

    // إدخال السجل الجديد بالكامل لتعود الحالة إلى "قيد المراجعة" ويختفي التقييم السابق
    const insertPayload = {
      assignment_id: assignment.id,
      student_id: (isOnePerGroup && mySubmission) ? mySubmission.student_id : user.id,
      group_id: myGroup?.id || null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      status: "pending" as const,
      is_late: !!isOverdue,
      reviewer_notes: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from("submissions").insert(insertPayload);
    dbErr = error;

    if (dbErr) {
      await supabase.storage.from("submissions").remove([path]);
      toast.error(dbErr.message);
    } else {
      toast.success("تم رفع التسليم بنجاح وهو الآن قيد المراجعة");
      load();
    }
    setUploading(false);
  };

  const handleDelete = async (subToDelete: any) => {
    if (!subToDelete) return;
    if (!confirm("حذف التسليم؟ سيُحذف الملف نهائيًا.")) return;
    
    if (subToDelete.file_path) {
      await supabase.storage.from("submissions").remove([subToDelete.file_path]).catch(() => {});
    }
    const { error } = await supabase.from("submissions").delete().eq("id", subToDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(filePath, 600);
    if (data) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!assignment) {
    return (
      <AppLayout>
        <Card><CardContent className="py-12 text-center text-muted-foreground">طلب التسليم غير موجود</CardContent></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/student"><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
          <div>
            <p className="text-sm text-muted-foreground">{course?.name}</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{assignment.title}</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل المطلوب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignment.description ? (
              <p className="whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
            ) : (
              <p className="text-muted-foreground text-sm">لم يُضف وصف لهذا الطلب</p>
            )}
            {assignment.due_date && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">📅 الموعد النهائي:</span>
                <span className="font-semibold">{new Date(assignment.due_date).toLocaleString("ar-EG")}</span>
                {isOverdue && <Badge variant="destructive">انتهى الموعد</Badge>}
              </div>
            )}
            {isGroupMode && (
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-primary" /> 
                    {myGroup ? `أنت في مجموعة: ${myGroup.name}` : "هذا التكليف يتطلب الانضمام لمجموعة"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isOnePerGroup ? "بحث واحد فقط مطلوب من المجموعة بالكامل." : "كل طالب في المجموعة يجب أن يسلم بحثاً مختلفاً."}
                  </p>
                </div>
                <Link to={`/student/assignments/${assignment.id}/groups`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users2 className="h-4 w-4" /> إدارة المجموعات
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {isGroupMode && !myGroup ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">يجب الانضمام لمجموعة أولاً</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                لن تتمكن من رفع التسليم الخاص بك أو بمجموعتك حتى تقوم بالانضمام إلى مجموعة أو إنشاء واحدة جديدة.
              </p>
              <Link to={`/student/assignments/${assignment.id}/groups`}>
                <Button>الذهاب لصفحة المجموعات</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" /> 
                {isOnePerGroup ? "تسليم المجموعة" : "تسليمك الشخصي"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Display Current Submission */}
              {mySubmission ? (() => {
                const sl = statusLabels[mySubmission.status];
                return (
                  <div className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={sl.variant}>{sl.label}</Badge>
                        {mySubmission.is_late && <Badge variant="destructive" className="text-xs">سُلِّم متأخر</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload(mySubmission.file_path, mySubmission.file_name)}>
                          <Download className="h-4 w-4" /> تحميل
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(mySubmission)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground break-all">📎 {mySubmission.file_name}</p>
                    <p className="text-xs text-muted-foreground">سُلِّم في: {new Date(mySubmission.submitted_at).toLocaleString("ar-EG")}</p>
                    {mySubmission.reviewer_notes && (
                      <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                        <p className="text-xs font-semibold mb-1 text-muted-foreground">ملاحظات المسؤول:</p>
                        <p className="whitespace-pre-wrap">{mySubmission.reviewer_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })() : null}

              {/* Upload Box */}
              {blocked && !mySubmission ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">انتهى موعد التسليم</p>
                    <p className="text-sm text-muted-foreground">لا يمكن رفع التسليم بعد الموعد النهائي.</p>
                  </div>
                </div>
              ) : (
                (!blocked || mySubmission?.status === "rejected" || mySubmission?.status === "resubmit_requested") && (
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                    />
                    <Button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      size="lg"
                      className="w-full gap-2"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {mySubmission ? "استبدال وإعادة الرفع" : "رفع ملف التسليم"}
                    </Button>
                  </div>
                )
              )}

              {/* View Other Members Submissions (If per_student inside a group) */}
              {isGroupMode && !isOnePerGroup && groupMembers.length > 1 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    تسليمات باقي أعضاء المجموعة
                  </h3>
                  <div className="space-y-2">
                    {groupMembers.filter(m => m.id !== user?.id).map(member => {
                      const mSub = allSubs.find(s => s.student_id === member.id);
                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                          <div>
                            <p className="text-sm font-medium">{member.full_name}</p>
                            {mSub ? (
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px] sm:max-w-xs">📎 {mSub.file_name}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">لم يتم التسليم بعد</p>
                            )}
                          </div>
                          {mSub && (
                            <Button variant="ghost" size="sm" onClick={() => handleDownload(mSub.file_path, mSub.file_name)}>
                              تحميل
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentAssignmentDetail;
