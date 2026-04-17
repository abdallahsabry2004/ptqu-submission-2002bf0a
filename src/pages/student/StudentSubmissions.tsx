import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2, Download } from "lucide-react";
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
      const { data } = await supabase
        .from("submissions")
        .select("*, assignments(title, course_id, courses(id, name))")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });
      const g: Record<string, any[]> = {};
      (data ?? []).forEach((s: any) => {
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
      a.href = data.signedUrl;
      a.download = s.file_name;
      a.click();
    } else toast.error("تعذر التحميل");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">سجل التسليمات</h1>
          <p className="text-muted-foreground">جميع تسليماتك مصنفة حسب المادة</p>
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
                              {s.is_late && <Badge variant="destructive" className="text-xs">متأخر</Badge>}
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
