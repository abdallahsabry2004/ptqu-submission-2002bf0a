import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2 } from "lucide-react";

const statusLabels: Record<string, { label: string; variant: any }> = {
  pending: { label: "قيد المراجعة", variant: "secondary" },
  approved: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  resubmit_requested: { label: "إعادة تسليم مطلوبة", variant: "outline" },
};

const StudentCourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const [{ data: c }, { data: ass }] = await Promise.all([
        supabase.from("courses").select("*").eq("id", id).single(),
        supabase
          .from("assignments")
          .select("*")
          .eq("course_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setCourse(c);
      setAssignments((ass as any) ?? []);
      const ids = (ass ?? []).map((a: any) => a.id);
      if (ids.length) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("*")
          .in("assignment_id", ids)
          .eq("student_id", user.id);
        const map: Record<string, any> = {};
        (subs ?? []).forEach((s: any) => { map[s.assignment_id] = s; });
        setSubmissions(map);
      }
      setLoading(false);
    })();
  }, [id, user]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/student/courses">
            <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold">{course?.name ?? "..."}</h1>
            {course?.description && <p className="text-muted-foreground">{course.description}</p>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>طلبات التسليم</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">لا توجد طلبات تسليم بعد</p>
              ) : (
                <ul className="space-y-2">
                  {assignments.map((a) => {
                    const s = submissions[a.id];
                    const sl = s ? statusLabels[s.status] : null;
                    return (
                      <li key={a.id}>
                        <Link to={`/student/assignments/${a.id}`}>
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition-smooth hover:border-primary hover:bg-primary/5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">{a.title}</p>
                                {sl && <Badge variant={sl.variant}>{sl.label}</Badge>}
                                {!s && <Badge variant="outline">لم يُسلَّم</Badge>}
                              </div>
                              {a.due_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  📅 {new Date(a.due_date).toLocaleString("ar-EG")}
                                </p>
                              )}
                            </div>
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentCourseDetail;
