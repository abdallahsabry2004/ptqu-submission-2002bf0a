import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Mail, Loader2, IdCard } from "lucide-react";

const Settings = () => {
  const { profile, refresh } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [email, setEmail] = useState(profile?.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);

  const changePassword = async () => {
    if (pw.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (pw !== pw2) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      toast.error(error.message);
    } else {
      // Mark must_change_password = false
      if (profile) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", profile.id);
        await refresh();
      }
      toast.success("تم تغيير كلمة المرور");
      setPw("");
      setPw2("");
    }
    setSavingPw(false);
  };

  const linkEmail = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("بريد إلكتروني غير صالح");
      return;
    }
    setSavingEmail(true);
    if (profile) {
      const { error } = await supabase
        .from("profiles")
        .update({ email: e })
        .eq("id", profile.id);
      if (error) {
        toast.error(error.message);
      } else {
        await refresh();
        toast.success("تم حفظ البريد الإلكتروني");
      }
    }
    setSavingEmail(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">إدارة حسابك وكلمة المرور والبريد الإلكتروني</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" /> معلومات الحساب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">الاسم الكامل</Label>
                <p className="font-semibold">{profile?.full_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">الرقم القومي</Label>
                <p className="font-mono font-semibold" dir="ltr">{profile?.national_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> تغيير كلمة المرور
            </CardTitle>
            <CardDescription>اختر كلمة مرور قوية (6 أحرف على الأقل)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newpw">كلمة المرور الجديدة</Label>
                <Input id="newpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newpw2">تأكيد كلمة المرور</Label>
                <Input id="newpw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            </div>
            <Button onClick={changePassword} disabled={savingPw} className="gap-2">
              {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ كلمة المرور
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> البريد الإلكتروني
            </CardTitle>
            <CardDescription>
              اربط بريدك الإلكتروني بحسابك (اختياري — لاستعادة كلمة المرور لاحقًا)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={linkEmail} disabled={savingEmail} className="gap-2">
              {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ البريد
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
