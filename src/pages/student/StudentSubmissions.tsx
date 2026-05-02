import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2, Download, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; variant: any }> = {
  pending: { label: "قيد المراجعة", variant: "secondary" },
  approved: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline" },
};

const StudentSubmissions = () => {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1. اجلب مجموعات الطالب
      const { data: myGroups } = await supabase
        .from("assignment_group_members")
        .select("group_id")
        .eq("student_id", user.id);
      const groupIds = (myGroups || []).map((g) => g.group_id);

      // 2. اجلب التسليمات: الخاصة بالطالب أو الخاصة بمجموعاته (سنفلتر لاحقاً)
      let query = supabase
        .from("submissions")
        .select("*, assignments(title, course_id, group_submission_mode, grouping_mode, courses(id, name))")
        .order("submitted_at", { ascending: false });

      if (groupIds.length > 0) {
        query = query.or(`student_id.eq.${user.id},group_id.in.(${groupIds.join(",")})`);
      } else {
        query = query.eq("student_id", user.id);
      }

      const { data } = await query;

      // 3. فلترة:
      // - التسليمات الفردية للطالب نفسه (بدون مجموعة) → تظهر دائماً
      // - التكليفات الجماعية وضع one_per_group → تظهر تسليم المجموعة (أياً كان صاحبه)
      // - التكليفات الجماعية وضع per_student → تظهر فقط تسليم الطالب نفسه
      const filtered = (data ?? []).filter((s: any) => {
        const a = s.assignments;
        if (!a) return s.student_id === user.id;
        const isGroup = a.grouping_mode && a.grouping_mode !== "none";
        if (!isGroup) return s.student_id === user.id;
        if (a.group_submission_mode === "one_per_group") return true;
        // per_student
        return s.student_id === user.id;
      });

      const g: Record<string, any[]> = {};
      filtered.forEach((s: any) => {
        const cName = s.assignments?.courses?.name ?? "غير محدد";
        if (!g[cName]) g[cName] = [];
        g[cName].push(s);
      });
      setGrouped(g);
      setLoading(false);
    })();
  }, [user]);

  const download = async (s: any) => {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(s.file_path, 600);
    if (data) {
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = s.file_name; a.click();
    } else toast.error("تعذر التحميل");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">سجل التسليمات</h1>
          <p className="text-muted-foreground">جميع تسليماتك الفردية والجماعية مصنفة حسب المقرر</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لا توجد تسليمات بعد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([course, subs]) => (
              <Card key={course}>
                <CardHeader>
                  <CardTitle className="text-base">{course}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {subs.map((s: any) => {
                      const sl = statusLabels[s.status];
                      return (
                        <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link to={`/student/assignments/${s.assignment_id}`} className="font-semibold hover:text-primary transition-smooth">
                                {s.assignments?.title}
                              </Link>
                              <Badge variant={sl.variant}>{sl.label}</Badge>
                              {s.group_id && <Badge variant="secondary" className="gap-1"><Users2 className="h-3 w-3"/> تسليم جماعي</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              📎 {s.file_name} · {new Date(s.submitted_at).toLocaleString("ar-EG")}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => download(s)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentSubmissions;
