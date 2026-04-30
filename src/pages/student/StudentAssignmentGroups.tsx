import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Loader2, Plus, UserPlus, LogOut as LogOutIcon, Check, X, Users2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { genderFromNationalId, genderLabel, type Gender } from "@/lib/gender";

interface Profile { id: string; full_name: string; national_id: string; gender?: Gender }
interface AGroup { id: string; name: string; max_size: number | null; created_by: string | null; members: Profile[] }
interface Invite { id: string; group_id: string; inviter_id: string; invitee_id: string; status: string; group_name?: string; inviter_name?: string }

const StudentAssignmentGroups = () => {
  const { id: assignmentId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [classmates, setClassmates] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<AGroup[]>([]);
  const [myInvites, setMyInvites] = useState<Invite[]>([]);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const [openInvite, setOpenInvite] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");

  const load = async () => {
    if (!assignmentId || !user) return;
    setLoading(true);
    const { data: a } = await supabase.from("assignments").select("id, title, course_id, grouping_mode, gender_filter, gender_split, max_group_size, groups_locked").eq("id", assignmentId).single();
    setAssignment(a);
    if (!a) { setLoading(false); return; }

    const { data: cs } = await supabase.from("course_students").select("student_id").eq("course_id", (a as any).course_id);
    const sids = ((cs as any) ?? []).map((r: any) => r.student_id) as string[];
    let profs: Profile[] = [];
    if (sids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name, national_id").in("id", sids);
      profs = ((p as any) ?? []).map((x: any) => ({ ...x, gender: genderFromNationalId(x.national_id) }));
    }
    const gf = (a as any).gender_filter as "any" | "male" | "female";
    const eligible = profs.filter((p) => gf === "any" ? true : p.gender === gf);
    setClassmates(eligible);

    const { data: gs } = await supabase.from("assignment_groups").select("id, name, max_size, created_by, assignment_group_members(student_id)").eq("assignment_id", assignmentId).order("created_at");
    const gList: AGroup[] = ((gs as any) ?? []).map((g: any) => {
      const memIds = (g.assignment_group_members ?? []).map((m: any) => m.student_id);
      const memProfs = profs.filter((p) => memIds.includes(p.id));
      return { id: g.id, name: g.name, max_size: g.max_size, created_by: g.created_by, members: memProfs };
    });
    setGroups(gList);

    const { data: inv } = await supabase.from("group_invitations").select("id, group_id, inviter_id, invitee_id, status").eq("assignment_id", assignmentId).eq("status", "pending");
    const invs = ((inv as any) ?? []) as Invite[];
    invs.forEach((i) => {
      const g = gList.find((x) => x.id === i.group_id);
      i.group_name = g?.name;
      const ip = profs.find((p) => p.id === i.inviter_id);
      i.inviter_name = ip?.full_name;
    });
    setMyInvites(invs.filter((i) => i.invitee_id === user.id));
    setSentInvites(invs.filter((i) => i.inviter_id === user.id));

    setLoading(false);
  };

  useEffect(() => { load(); }, [assignmentId, user]);

  const myGroup = useMemo(() => groups.find((g) => g.members.some((m) => m.id === user?.id)) ?? null, [groups, user]);
  const sizeFor = (g: AGroup) => g.max_size ?? assignment?.max_group_size ?? null;
  const isLocked = !!assignment?.groups_locked;
  const isSelfMode = assignment?.grouping_mode === "student_self";
  const canEdit = isSelfMode && !isLocked;
  const myGender = classmates.find(c => c.id === user?.id)?.gender;

  // دالة ذكية للتحقق من توافق النوع (عزل/دمج) قبل عرض زر الانضمام لمجموعة
  const canJoinGender = (g: AGroup) => {
    if (assignment?.gender_split !== "separated") return true;
    if (g.members.length === 0) return true;
    return g.members[0].gender === myGender;
  };

  const createGroup = async () => {
    if (!newName.trim()) return toast.error("اسم المجموعة مطلوب");
    if (myGroup) return toast.error("أنت بالفعل في مجموعة. اخرج منها أولاً.");
    setBusy(true);
    const { data: g, error } = await supabase.from("assignment_groups").insert({ assignment_id: assignmentId, name: newName.trim(), max_size: assignment?.max_group_size ?? null, created_by: user!.id }).select("id").single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    const { error: e2 } = await supabase.from("assignment_group_members").insert({ group_id: (g as any).id, student_id: user!.id, assignment_id: assignmentId! });
    if (e2) toast.error(e2.message); else toast.success("تم إنشاء المجموعة والانضمام إليها");
    setOpenCreate(false); setNewName(""); setBusy(false); load();
  };

  const joinGroup = async (gid: string) => {
    if (myGroup) return toast.error("اخرج من مجموعتك الحالية أولاً");
    setBusy(true);
    const { error } = await supabase.from("assignment_group_members").insert({ group_id: gid, student_id: user!.id, assignment_id: assignmentId! });
    if (error) toast.error("تعذر الانضمام، قد تكون المجموعة ممتلئة أو تخالف الشروط"); else { toast.success("تم الانضمام بنجاح"); load(); }
    setBusy(false);
  };

  const leaveGroup = async () => {
    if (!myGroup) return;
    if (!confirm("هل أنت متأكد من الخروج من المجموعة؟")) return;
    setBusy(true);
    const { error } = await supabase.from("assignment_group_members").delete().eq("group_id", myGroup.id).eq("student_id", user!.id);
    if (error) toast.error(error.message); else { toast.success("تم الخروج من المجموعة"); load(); }
    setBusy(false);
  };

  const sendInvite = async (inviteeId: string) => {
    if (!myGroup) return toast.error("لا توجد مجموعة لإرسال الدعوة منها");
    setBusy(true);
    const { error } = await supabase.from("group_invitations").insert({ assignment_id: assignmentId, group_id: myGroup.id, inviter_id: user!.id, invitee_id: inviteeId, status: "pending" });
    if (error) toast.error(error.message); else toast.success("تم إرسال الدعوة بنجاح");
    setBusy(false); load();
  };

  const respondInvite = async (inv: Invite, accept: boolean) => {
    setBusy(true);
    if (accept) {
      if (myGroup) await supabase.from("assignment_group_members").delete().eq("group_id", myGroup.id).eq("student_id", user!.id);
      const { error } = await supabase.from("assignment_group_members").insert({ group_id: inv.group_id, student_id: user!.id, assignment_id: assignmentId! });
      if (error) { toast.error("تعذر الانضمام، المجموعة ممتلئة"); setBusy(false); return; }
    }
    const { error: e2 } = await supabase.from("group_invitations").update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() }).eq("id", inv.id);
    if (e2) toast.error(e2.message); else toast.success(accept ? "تم قبول الدعوة والانضمام" : "تم رفض الدعوة");
    setBusy(false); load();
  };

  const cancelInvite = async (inv: Invite) => {
    setBusy(true);
    const { error } = await supabase.from("group_invitations").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", inv.id);
    if (error) toast.error(error.message); else toast.success("تم إلغاء الدعوة");
    setBusy(false); load();
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  if (!assignment) return <AppLayout><Card><CardContent className="py-12 text-center text-muted-foreground">طلب التسليم غير موجود</CardContent></Card></AppLayout>;

  const inGroupIds = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
  const sentIds = new Set(sentInvites.map((i) => i.invitee_id));
  
  const candidates = classmates.filter((c) => {
    if (c.id === user?.id || inGroupIds.has(c.id) || sentIds.has(c.id)) return false;
    if (inviteSearch && !(c.full_name.includes(inviteSearch) || c.national_id.includes(inviteSearch))) return false;
    // منع ظهور الجنس الآخر في الدعوات إذا كان التكليف "معزول" (مفصولة)
    if (assignment.gender_split === "separated" && myGender && c.gender !== myGender) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/student/assignments/${assignmentId}`}><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2 flex-wrap"><Users2 className="h-6 w-6 text-primary" /> مجموعات: {assignment.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
              <Badge variant="outline">حد المجموعة: {assignment.max_group_size ?? "غير محدود"}</Badge>
              <Badge variant="outline">النوع: {assignment.gender_filter === "male" ? "ذكور فقط" : assignment.gender_filter === "female" ? "إناث فقط" : "الجميع مسموح"}</Badge>
              {isLocked && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> مقفل من المسؤول</Badge>}
            </div>
          </div>
        </div>

        {!isSelfMode && (<Card><CardContent className="py-6"><p className="text-sm text-muted-foreground">المسؤول هو من يقوم بتقسيم المجموعات لهذا الطلب. تجد مجموعتك أدناه.</p></CardContent></Card>)}

        {myInvites.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> دعوات وردت إليك</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {myInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 flex-wrap">
                  <div className="text-sm"><span className="font-semibold">{inv.inviter_name}</span> دعاك للانضمام إلى <span className="font-semibold">{inv.group_name}</span></div>
                  <div className="flex gap-1">
                    <Button size="sm" className="gap-1" onClick={() => respondInvite(inv, true)} disabled={busy}><Check className="h-4 w-4" /> قبول</Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => respondInvite(inv, false)} disabled={busy}><X className="h-4 w-4" /> رفض</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!myGroup && (
              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> إنشاء مجموعة جديدة</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>إنشاء مجموعة</DialogTitle></DialogHeader>
                  <div className="space-y-2"><Label>اسم المجموعة *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="فريق المتميزين" /></div>
                  <DialogFooter><Button onClick={createGroup} disabled={busy}>إنشاء والانضمام</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {myGroup && (
              <>
                <Dialog open={openInvite === myGroup.id} onOpenChange={(v) => setOpenInvite(v ? myGroup.id : null)}>
                  <DialogTrigger asChild><Button className="gap-2"><UserPlus className="h-4 w-4" /> دعوة طالب لمجموعتي</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>دعوة طالب</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                      <Input placeholder="بحث بالاسم أو الرقم القومي" value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} />
                      <div className="max-h-64 overflow-auto border rounded-lg divide-y">
                        {candidates.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">لا يوجد طلاب متاحين للدعوة حالياً</p>}
                        {candidates.map((c) => (
                          <div key={c.id} className="flex items-center justify-between p-2 gap-2">
                            <div className="min-w-0"><p className="text-sm font-medium truncate">{c.full_name}</p></div>
                            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => sendInvite(c.id)}><UserPlus className="h-3.5 w-3.5" /> دعوة</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={leaveGroup} disabled={busy}><LogOutIcon className="h-4 w-4" /> الخروج من مجموعتي</Button>
              </>
            )}
          </div>
        )}

        {sentInvites.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">دعوات أرسلتها</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sentInvites.map((inv) => {
                const invitee = classmates.find((c) => c.id === inv.invitee_id);
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 flex-wrap">
                    <div className="text-sm">دعوة معلّقة لـ <span className="font-semibold">{invitee?.full_name ?? "طالب"}</span></div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelInvite(inv)}>إلغاء</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {groups.length === 0 && (<Card className="md:col-span-2"><CardContent className="py-10 text-center text-muted-foreground">لا توجد مجموعات بعد{canEdit ? " — يمكنك إنشاء واحدة" : ""}</CardContent></Card>)}
          {groups.map((g) => {
            const cap = sizeFor(g);
            const full = cap !== null && g.members.length >= cap;
            const mine = g.members.some((m) => m.id === user?.id);
            return (
              <Card key={g.id} className={mine ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      {g.name}
                      <Badge variant={full ? "destructive" : "secondary"}>{g.members.length}{cap ? ` / ${cap}` : ""}</Badge>
                      {mine && <Badge>مجموعتي</Badge>}
                    </CardTitle>
                    {canEdit && !mine && !full && !myGroup && canJoinGender(g) && (
                      <Button size="sm" onClick={() => joinGroup(g.id)} disabled={busy}>انضمام</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {g.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">لا يوجد أعضاء</p>
                  ) : (
                    <ul className="divide-y border rounded-lg overflow-hidden">
                      {g.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                          <div className="min-w-0"><p className="truncate font-medium">{m.full_name}</p></div>
                          <span className="text-xs text-muted-foreground">{genderLabel[m.gender ?? "unknown"]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default StudentAssignmentGroups;
