import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const StudentCourses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("course_students")
        .select("courses(id, name, code, description)")
        .eq("student_id", user.id);
      setCourses(((data ?? []) as any[]).map((r) => r.courses).filter(Boolean));
      setLoading(false);
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">مقرراتي</h1>
          <p className="text-muted-foreground">المقررات الدراسية المسجل بها</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">لم يضفك المسؤول لأي مقرر بعد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id} className="transition-smooth hover:shadow-elegant hover:-translate-y-0.5">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-bold text-lg leading-tight mb-1">{c.name}</h3>
                  {c.code && <p className="text-xs font-mono text-muted-foreground mb-2">{c.code}</p>}
                  {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{c.description}</p>}
                  <Link to={`/student/courses/${c.id}`}>
                    <Button variant="outline" className="w-full gap-2">
                      عرض المقرر
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentCourses;
