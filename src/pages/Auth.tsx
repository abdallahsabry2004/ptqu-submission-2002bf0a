import { useState, FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { GraduationCap, Loader2, ArrowRight } from "lucide-react";

const Auth = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user && role) {
    const dest = role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/student";
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nid = nationalId.trim();
    if (!/^\d{5,20}$/.test(nid)) {
      toast.error("الرقم القومي يجب أن يكون أرقامًا فقط");
      return;
    }
    if (!password) {
      toast.error("أدخل كلمة المرور");
      return;
    }

    setSubmitting(true);
    try {
      const emailCandidates = [
        `${nid}@students.local`,
        `${nid}@supervisors.local`,
        `${nid}@admin.local`,
      ];
      let signedIn = false;

      for (const email of emailCandidates) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          signedIn = true;
          break;
        }
      }

      if (!signedIn) {
        toast.error("بيانات الدخول غير صحيحة");
        return;
      }

      toast.success("تم تسجيل الدخول");
      navigate("/", { replace: true });
    } catch {
      toast.error("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/30 to-primary/5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.08),transparent_50%)]" />
      <Card className="w-full max-w-md shadow-elegant border-border/50 animate-scale-in">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-hero text-primary-foreground shadow-elegant">
            <GraduationCap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-display">تسجيل الدخول</CardTitle>
          <CardDescription>أدخل الرقم القومي وكلمة المرور للوصول إلى حسابك</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nid">الرقم القومي</Label>
              <Input
                id="nid"
                inputMode="numeric"
                dir="ltr"
                placeholder="مثال: 30409302705170"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                autoComplete="username"
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">كلمة المرور</Label>
              <PasswordInput
                id="pw"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                إذا كانت أول مرة، استخدم رقمك القومي ككلمة مرور
              </p>
            </div>
            <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              دخول
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to="/" className="text-muted-foreground hover:text-primary transition-smooth">
              ← العودة للصفحة الرئيسية
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
