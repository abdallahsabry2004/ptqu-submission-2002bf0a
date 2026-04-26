import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, KeyRound, Eye, EyeOff, Search, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string;
  national_id: string;
  current_password: string | null;
}
interface ResetReq {
  id: string;
  user_id: string;
  national_id: string;
  message: string | null;
  status: string;
  created_at: string;
}

const AdminPasswords = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<ResetReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Record<string, boolean>>({});

  // dialog state
  const [dlgUser, setDlgUser] = useState<Profile | null>(null);
  const [dlgRequestId, setDlgRequestId] = useState<string | null>(null);
  const [dlgPwd, setDlgPwd] = useState("");
  const [dlgBusy, setDlgBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profs } = await supabase.rpc("admin_list_account_passwords");
    const { data: reqs } = await supabase
      .from("password_reset_requests")
      .select("id, user_id, national_id, message, status, created_at")
      .order("created_at", { ascending: false });

    setProfiles(((profs as any) ?? []) as Profile[]);
    setRequests((reqs as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = profiles.filter(
    (p) => p.full_name.toLowerCase().includes(q.toLowerCase()) || p.national_id.includes(q),
  );
  const pendingRequests = requests.filter((r) => r.status === "pending");

  const openSet = (p: Profile, requestId: string | null = null) => {
    setDlgUser(p);
    setDlgRequestId(requestId);
    setDlgPwd("");
  };
  const openResetToNid = async (p: Profile, requestId: string | null = null) => {
    if (!confirm(`إعادة كلمة مرور ${p.full_name} إلى الرقم القومي (${p.national_id})؟`)) return;
    await applySet(p.id, p.national_id, requestId);
  };

  const applySet = async (userId: string, password: string, requestId: string | null) => {
    const { data, error } = await supabase.functions.invoke("admin-set-password", {
      body: { user_id: userId, password, request_id: requestId ?? undefined },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "تعذر تغيير كلمة المرور");
    } else {
      toast.success("تم تغيير كلمة المرور");
      load();
    }
  };

  const submitDlg = async () => {
    if (!dlgUser) return;
    if (dlgPwd.trim().length < 6) {
      toast.error("الحد الأدنى 6 أحرف");
      return;
    }
    setDlgBusy(true);
    await applySet(dlgUser.id, dlgPwd.trim(), dlgRequestId);
    setDlgBusy(false);
    setDlgUser(null);
    setDlgRequestId(null);
  };

  const dismiss = async (id: string) => {
    await supabase
      .from("password_reset_requests")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", id);
    load();
  };

  const profileOf = (uid: string) => profiles.find((p) => p.id === uid);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <KeyRound className="h-7 w-7 text-primary" />
              كلمات المرور
            </h1>
            <p className="text-muted-foreground">
              عرض كلمات مرور الطلاب والمشرفين، وإدارة طلبات إعادة التعيين
            </p>
          </div>
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="text-sm">
              {pendingRequests.length} طلب جديد
            </Badge>
          )}
        </div>

        <Tabs defaultValue={pendingRequests.length > 0 ? "requests" : "list"}>
          <TabsList>
            <TabsTrigger value="requests" className="gap-2">
              طلبات الاستعادة
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="list">قائمة الحسابات</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  لا توجد طلبات استعادة كلمة مرور حالياً
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((r) => {
                const p = profileOf(r.user_id);
                return (
                  <Card key={r.id}>
                    <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p?.full_name ?? "—"}</p>
                        <p className="text-xs font-mono text-muted-foreground" dir="ltr">{r.national_id}</p>
                        {r.message && (
                          <p className="text-sm text-muted-foreground mt-2">💬 {r.message}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleString("ar-EG")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {p && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => openResetToNid(p, r.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              إرجاع للرقم القومي
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => openSet(p, r.id)}
                            >
                              <Check className="h-4 w-4" />
                              تعيين كلمة جديدة
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground"
                          onClick={() => dismiss(r.id)}
                        >
                          <X className="h-4 w-4" />
                          تجاهل
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو الرقم القومي"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pr-10"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {filtered.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{p.full_name}</p>
                          <p className="text-xs font-mono text-muted-foreground" dir="ltr">{p.national_id}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <code
                            className="rounded bg-muted px-2 py-1 text-xs font-mono select-all"
                            dir="ltr"
                          >
                            {show[p.id] ? (p.current_password ?? "—") : "••••••••"}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}
                            aria-label="إظهار/إخفاء"
                          >
                            {show[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openResetToNid(p)}
                            title="إرجاع للرقم القومي"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openSet(p)}
                            title="تعيين كلمة جديدة"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                    {filtered.length === 0 && (
                      <li className="px-5 py-12 text-center text-muted-foreground">لا توجد نتائج</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!dlgUser} onOpenChange={(o) => !o && setDlgUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {dlgUser && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">{dlgUser.full_name}</p>
                  <p className="text-xs font-mono text-muted-foreground" dir="ltr">{dlgUser.national_id}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input
                  value={dlgPwd}
                  onChange={(e) => setDlgPwd(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  dir="ltr"
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitDlg} disabled={dlgBusy} className="gap-2">
                {dlgBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminPasswords;