import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, FileText, ClipboardList, Loader2 } from "lucide-react";

const SupervisorDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ courses: 0, assignments: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase
        .from("course_supervisors")
        .select("course_id")
        .eq("supervisor_id", user.id);
      const courseIds = (links ?? []).map((l: any) => l.course_id);

      let assignmentsCount = 0;
      let pendingCount = 0;
      if (courseIds.length > 0) {
        const { data: ass } = await supabase
          .from("assignments")
          .select("id")
          .in("course_id", courseIds);
        assignmentsCount = ass?.length ?? 0;
        const assignmentIds = (ass ?? []).map((a: any) => a.id);
        if (assignmentIds.length > 0) {
          const { count } = await supabase
            .from("submissions")
            .select("id", { count: "exact", head: true })
            .in("assignment_id", assignmentIds)
            .eq("status", "pending");
          pendingCount = count ?? 0;
        }
      }
      setStats({ courses: courseIds.length, assignments: assignmentsCount, pending: pendingCount });
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { label: "مقرراتي", value: stats.courses, icon: BookOpen, href: "/supervisor/courses", color: "from-primary to-primary-glow" },
    { label: "طلبات التسليم", value: stats.assignments, icon: FileText, href: "/supervisor/assignments", color: "from-success to-primary-glow" },
    { label: "بانتظار المراجعة", value: stats.pending, icon: ClipboardList, href: "/supervisor/assignments", color: "from-warning to-destructive" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">لوحة المشرف</h1>
          <p className="text-muted-foreground">المقررات والتسليمات الخاصة بك</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {cards.map((c) => (
              <Link key={c.label} to={c.href}>
                <Card className="overflow-hidden transition-smooth hover:shadow-elegant hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-5">
                    <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow-soft`}>
                      <c.icon className="h-5 w-5" />
                    </div>
                    <p className="text-3xl font-display font-bold">{c.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SupervisorDashboard;
