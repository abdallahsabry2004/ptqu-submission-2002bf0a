import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, Loader2, ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
}

const AdminCourses = () => {
  const { role, user } = useAuth();
  const isSupervisor = role === "supervisor";
  const baseRoute = isSupervisor ? "/supervisor" : "/admin";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    if (isSupervisor && user) {
      const { data: links } = await supabase
        .from("course_supervisors")
        .select("course_id")
        .eq("supervisor_id", user.id);
      const ids = ((links as any) ?? []).map((l: any) => l.course_id) as string[];
      if (ids.length === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setCourses((data as any) ?? []);
    } else {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setCourses((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupervisor, user?.id]);

  const create = async () => {
    if (!name.trim()) {
      toast.error("اسم المقرر مطلوب");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("courses").insert({
      name: name.trim(),
      code: code.trim() || null,
      description: desc.trim() || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إنشاء المقرر");
      setOpen(false);
      setName("");
      setCode("");
      setDesc("");
      load();
    }
    setCreating(false);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا المقرر؟ سيتم حذف كل التسليمات المرتبطة به.")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">
              {isSupervisor ? "مقرراتي" : "المقررات"}
            </h1>
            <p className="text-muted-foreground">
              {isSupervisor
                ? "المقررات المسندة إليك من المسؤول"
                : "إنشاء وإدارة المقررات الدراسية"}
            </p>
          </div>
          {!isSupervisor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                مقرر جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء مقرر جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>اسم المقرر *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مناهج البحث العلمي" />
                </div>
                <div className="space-y-2">
                  <Label>كود المقرر (اختياري)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: RES101" />
                </div>
                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
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
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {isSupervisor
                  ? "لم يُسند إليك أي مقرر بعد"
                  : "لا توجد مقررات بعد. أنشئ أول مقرر للبدء."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id} className="group transition-smooth hover:shadow-elegant hover:-translate-y-0.5">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    {!isSupervisor && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-smooth h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-lg leading-tight mb-1">{c.name}</h3>
                  {c.code && <p className="text-xs font-mono text-muted-foreground mb-2">{c.code}</p>}
                  {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{c.description}</p>}
                  <Link to={`${baseRoute}/courses/${c.id}`}>
                    <Button variant="outline" className="w-full gap-2">
                      إدارة المقرر
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

export default AdminCourses;
