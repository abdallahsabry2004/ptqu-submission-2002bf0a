import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, BookOpen, Bell, AlertCircle, CheckCircle2 } from "lucide-react";

interface AssignmentItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  course_id: string;
  course_name: string;
  has_submission: boolean;
  submission_status: string | null;
}

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [coursesCount, setCoursesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ass } = await supabase
        .from("assignments")
        .select("id, title, description, due_date, course_id, courses(name)")
        .order("created_at", { ascending: false });
      const ids = (ass ?? []).map((a: any) => a.id);
      const { data: subs } = await supabase
        .from("submissions")
        .select("assignment_id, status")
        .in("assignment_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .eq("student_id", user.id);
      const subMap = new Map((subs ?? []).map((s: any) => [s.assignment_id, s.status]));
      setItems(
        ((ass ?? []) as any[]).map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          due_date: a.due_date,
          course_id: a.course_id,
          course_name: a.courses?.name ?? "",
          has_submission: subMap.has(a.id),
          submission_status: subMap.get(a.id) ?? null,
        }))
      );
      const { count } = await supabase
        .from("course_students")
        .select("*", { count: "exact", head: true })
        .eq("student_id", user.id);
      setCoursesCount(count ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const pending = items.filter((i) => !i.has_submission || i.submission_status === "resubmit_requested" || i.submission_status === "rejected");

  const mustChange = profile?.must_change_password;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">مرحبًا، {profile?.full_name}</h1>
          <p className="text-muted-foreground">إليك ملخص نشاطك الأكاديمي</p>
        </div>

        {mustChange && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">يفضّل تغيير كلمة المرور</p>
                <p className="text-sm text-muted-foreground">لأمان حسابك، اختر كلمة مرور خاصة بدلاً من رقمك القومي.</p>
              </div>
              <Link to="/settings"><Button variant="outline" size="sm">الإعدادات</Button></Link>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-display font-bold">{coursesCount}</p>
                  <p className="text-sm text-muted-foreground">المقررات المسجل بها</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-display font-bold">{pending.length}</p>
                  <p className="text-sm text-muted-foreground">طلبات تسليم بانتظارك</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-display font-bold">{items.filter((i) => i.submission_status === "approved").length}</p>
                  <p className="text-sm text-muted-foreground">تسليمات مقبولة</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  الطلبات الحالية
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">🎉 لا توجد طلبات معلقة</p>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((p) => (
                      <li key={p.id}>
                        <Link to={`/student/assignments/${p.id}`} className="block">
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition-smooth hover:border-primary hover:bg-primary/5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">{p.title}</p>
                                <Badge variant="outline" className="text-xs">{p.course_name}</Badge>
                                {p.submission_status === "rejected" && (
                                  <Badge variant="destructive" className="text-xs">مرفوض — أعد التسليم</Badge>
                                )}
                                {p.submission_status === "resubmit_requested" && (
                                  <Badge className="text-xs bg-warning text-warning-foreground">إعادة تسليم مطلوبة</Badge>
                                )}
                              </div>
                              {p.due_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  📅 الموعد النهائي: {new Date(p.due_date).toLocaleString("ar-EG")}
                                </p>
                              )}
                            </div>
                            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentDashboard;
