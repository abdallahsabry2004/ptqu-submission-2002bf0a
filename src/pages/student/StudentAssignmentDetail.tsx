import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Loader2, Upload, Download, Trash2, AlertCircle, CheckCircle2, Users2, FileText } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; variant: any; icon: any; color: string }> = {
  pending: { label: "قيد المراجعة", variant: "secondary", icon: Loader2, color: "text-muted-foreground" },
  approved: { label: "مقبول", variant: "default", icon: CheckCircle2, color: "text-success" },
  rejected: { label: "مرفوض — أعد التسليم", variant: "destructive", icon: AlertCircle, color: "text-destructive" },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline", icon: AlertCircle, color: "text-warning" },
};

const formatSpeed = (bps: number) => {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
};

const StudentAssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  
  // Group states
  const [myGroup, setMyGroup] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [allSubs, setAllSubs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    
    const { data: a } = await supabase.from("assignments").select("*, courses(id, name)").eq("id", id).single();
    setAssignment(a);
    setCourse((a as any)?.courses);

    if (!a) { setLoading(false); return; }

    let currentGroup = null;

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

  const isGroupMode = assignment?.grouping_mode !== "none";
  const isOnePerGroup = isGroupMode && assignment?.group_submission_mode === "one_per_group";

  // العثور على التسليم الحالي للطالب
  const mySubmission = isOnePerGroup ? allSubs[0] : allSubs.find(s => s.student_id === user?.id);

  const handleUpload = async (file: File) => {
    if (!user || !assignment) return;
    
    // إزالة التقييد للامتدادات كما طلبت، وتركنا حجم الملف فقط لتجنب تعليق السيرفر
    if (file.size > 50 * 1024 * 1024) {
      toast.error("الحد الأقصى لحجم الملف هو 50 ميجا بايت");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);

    const safe = file.name.replace(/[^\w.\-آ-ي]/g, "_");
    const path = `${user.id}/${assignment.id}/${Date.now()}_${safe}`;

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (!session || sessionErr) throw new Error("انتهت الجلسة، يرجى تحديث الصفحة والمحاولة مجدداً.");

      // الاستبدال المباشر: حذف الملف القديم قبل الرفع
      if (mySubmission?.file_path) {
        await supabase.storage.from("submissions").remove([mySubmission.file_path]).catch(()=>{});
      }

      const { data: { publicUrl } } = supabase.storage.from("submissions").getPublicUrl("");
      const uploadUrl = publicUrl.replace('/object/public/', '/object/') + path;

      // XHR لإظهار نسبة وسرعة الرفع الحقيقية
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let startTime = Date.now();
        let lastLoaded = 0;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);

            const now = Date.now();
            const timeDiff = (now - startTime) / 1000;
            if (timeDiff > 0.5) {
              const speedBps = (event.loaded - lastLoaded) / timeDiff;
              setUploadSpeed(speedBps);
              startTime = now;
              lastLoaded = event.loaded;
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error("فشل الخادم في حفظ الملف"));
        };
        xhr.onerror = () => reject(new Error("حدث خطأ في الاتصال بالإنترنت"));

        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      // حذف السجل القديم من قاعدة البيانات
      if (mySubmission) {
        await supabase.from("submissions").delete().eq("id", mySubmission.id);
      }

      // إدخال السجل الجديد (وإصلاح مشكلة الـ group_id)
      const insertPayload = {
        assignment_id: assignment.id,
        student_id: (isOnePerGroup && mySubmission) ? mySubmission.student_id : user.id,
        group_id: myGroup?.id || null, // <- تم إضافة هذا السطر الهام جداً
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

      const { error: dbErr } = await supabase.from("submissions").insert(insertPayload);

      if (dbErr) {
        throw new Error(dbErr.message);
      } else {
        toast.success("تم رفع التسليم بنجاح، وهو الآن قيد المراجعة.");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع أثناء الرفع.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
    }
  };

  const handleDelete = async () => {
    if (!mySubmission) return;
    if (!confirm("هل أنت متأكد من حذف التسليم؟ سيتم حذف الملف نهائياً.")) return;
    
    if (mySubmission.file_path) {
      await supabase.storage.from("submissions").remove([mySubmission.file_path]);
    }
    const { error } = await supabase.from("submissions").delete().eq("id", mySubmission.id);
    if (error) toast.error(error.message);
    else { toast.success("تم حذف التسليم بنجاح"); load(); }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(filePath, 600);
    if (data) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  if (!assignment) return <AppLayout><Card><CardContent className="py-12 text-center text-muted-foreground">طلب التسليم غير موجود</CardContent></Card></AppLayout>;

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
          <CardHeader><CardTitle className="text-base">تفاصيل المطلوب</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignment.description ? <p className="whitespace-pre-wrap leading-relaxed">{assignment.description}</p> : <p className="text-muted-foreground text-sm">لم يُضف وصف لهذا الطلب</p>}
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
                  <Button variant="outline" size="sm" className="gap-2"><Users2 className="h-4 w-4" /> إدارة المجموعات</Button>
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
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">لن تتمكن من رفع التسليم حتى تنضم أو تنشئ مجموعة.</p>
              <Link to={`/student/assignments/${assignment.id}/groups`}><Button>الذهاب لصفحة المجموعات</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> {isOnePerGroup ? "تسليم المجموعة" : "تسليمك الشخصي"}</CardTitle>
              <CardDescription>{mySubmission ? "تسليمك الحالي" : "ارفع ملف التسليم"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mySubmission && (() => {
                const sl = statusLabels[mySubmission.status];
                return (
                  <div className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={sl.variant}>{sl.label}</Badge>
                        {mySubmission.is_late && <Badge variant="destructive" className="text-xs">سُلِّم متأخر</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownloadFile(mySubmission.file_path, mySubmission.file_name)}><Download className="h-4 w-4" /> تحميل</Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
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
              })()}

              {blocked && !mySubmission ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div><p className="font-semibold text-destructive">انتهى موعد التسليم</p><p className="text-sm text-muted-foreground">لا يمكن رفع التسليم بعد الموعد النهائي.</p></div>
                </div>
              ) : (
                (!blocked || mySubmission?.status === "rejected" || mySubmission?.status === "resubmit_requested") && (
                  <div className="space-y-3">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                    {!uploading ? (
                      <Button onClick={() => fileRef.current?.click()} size="lg" className="w-full gap-2">
                        <Upload className="h-4 w-4" /> {mySubmission ? "استبدال وإعادة رفع التسليم" : "اختيار ورفع ملف التسليم"}
                      </Button>
                    ) : (
                      <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> جاري الرفع...</span>
                          <span className="font-mono">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-left" dir="ltr">{formatSpeed(uploadSpeed)}</p>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* رؤية تسليمات باقي أفراد المجموعة */}
              {isGroupMode && !isOnePerGroup && groupMembers.length > 1 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> تسليمات باقي أعضاء مجموعتك</h3>
                  <div className="space-y-2">
                    {groupMembers.filter(m => m.id !== user?.id).map(member => {
                      const mSub = allSubs.find(s => s.student_id === member.id);
                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                          <div>
                            <p className="text-sm font-medium">{member.full_name}</p>
                            {mSub ? (<p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px] sm:max-w-xs">📎 {mSub.file_name}</p>) : (<p className="text-xs text-muted-foreground mt-1">لم يتم التسليم بعد</p>)}
                          </div>
                          {mSub && <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(mSub.file_path, mSub.file_name)}>تحميل</Button>}
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
