import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Users, FileText, ClipboardList, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ courses: 0, students: 0, assignments: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, s, a, p] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("assignments").select("id", { count: "exact", head: true }),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({
        courses: c.count ?? 0,
        students: s.count ?? 0,
        assignments: a.count ?? 0,
        pending: p.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "المقررات", value: stats.courses, icon: BookOpen, href: "/admin/courses", color: "from-primary to-primary-glow" },
    { label: "الطلاب", value: stats.students, icon: Users, href: "/admin/students", color: "from-accent to-warning" },
    { label: "طلبات التسليم", value: stats.assignments, icon: FileText, href: "/admin/assignments", color: "from-success to-primary-glow" },
    { label: "بانتظار المراجعة", value: stats.pending, icon: ClipboardList, href: "/admin/assignments", color: "from-warning to-destructive" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">لوحة المسؤول</h1>
          <p className="text-muted-foreground">نظرة عامة على المنصة</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <Card>
          <CardHeader>
            <CardTitle>الإجراءات السريعة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Link to="/admin/courses" className="rounded-xl border border-border p-4 transition-smooth hover:border-primary hover:bg-primary/5">
              <BookOpen className="h-6 w-6 text-primary mb-2" />
              <p className="font-semibold">إنشاء مقرر جديد</p>
            </Link>
            <Link to="/admin/students" className="rounded-xl border border-border p-4 transition-smooth hover:border-primary hover:bg-primary/5">
              <Users className="h-6 w-6 text-primary mb-2" />
              <p className="font-semibold">إدارة الطلاب</p>
            </Link>
            <Link to="/admin/assignments" className="rounded-xl border border-border p-4 transition-smooth hover:border-primary hover:bg-primary/5">
              <FileText className="h-6 w-6 text-primary mb-2" />
              <p className="font-semibold">طلبات التسليم</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
