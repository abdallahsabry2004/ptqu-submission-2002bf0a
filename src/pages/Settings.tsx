import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { KeyRound, Loader2, IdCard, Phone } from "lucide-react";

const Settings = () => {
  const { profile, refresh } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_number ?? "");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const mustChangePassword = profile?.must_change_password;

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
          .update({ must_change_password: false, current_password: pw })
          .eq("id", profile.id);
        await refresh();
      }
      toast.success("تم تغيير كلمة المرور");
      setPw("");
      setPw2("");
    }
    setSavingPw(false);
  };

  const saveWhatsapp = async () => {
    const phone = whatsapp.trim().replace(/[\s-]/g, "");
    if (phone && !/^\+?\d{10,15}$/.test(phone)) {
      toast.error("رقم واتساب غير صالح");
      return;
    }
    setSavingWhatsapp(true);
    if (profile) {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: phone || null } as any)
        .eq("id", profile.id);
      if (error) {
        toast.error(error.message);
      } else {
        await refresh();
        toast.success("تم حفظ رقم واتساب");
      }
    }
    setSavingWhatsapp(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">إدارة حسابك وكلمة المرور ورقم واتساب</p>
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
            <CardDescription>
              {mustChangePassword ? "يجب تغيير كلمة المرور الحالية قبل متابعة استخدام المنصة" : "اختر كلمة مرور قوية (6 أحرف على الأقل)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mustChangePassword && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
                كلمة المرور الحالية مؤقتة، ولن تتمكن من متابعة استخدام المنصة قبل تعيين كلمة مرور جديدة.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newpw">كلمة المرور الجديدة</Label>
                <PasswordInput id="newpw" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newpw2">تأكيد كلمة المرور</Label>
                <PasswordInput id="newpw2" value={pw2} onChange={(e) => setPw2(e.target.value)} />
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
              <Phone className="h-5 w-5 text-primary" /> رقم واتساب
            </CardTitle>
            <CardDescription>
              أضف رقم واتساب حتى يستطيع المسؤول التواصل معك عند الحاجة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">رقم واتساب</Label>
              <Input
                id="whatsapp"
                type="tel"
                dir="ltr"
                placeholder="+201001234567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <Button onClick={saveWhatsapp} disabled={savingWhatsapp} className="gap-2">
              {savingWhatsapp && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ رقم واتساب
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
