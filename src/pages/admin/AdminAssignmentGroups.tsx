import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2, Plus, Trash2, Shuffle, Lock, Unlock, Users2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { genderFromNationalId, genderLabel, type Gender } from "@/lib/gender";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  id: string;
  full_name: string;
  national_id: string;
  gender?: Gender;
}
interface AGroup {
  id: string;
  name: string;
  max_size: number | null;
  members: Profile[];
}

const AdminAssignmentGroups = () => {
  const { role } = useAuth();
  const baseRoute = role === "supervisor" ? "/supervisor" : "/admin";
  const { id: assignmentId } = useParams<{ id: string }>();
  const [assignment, setAssignment] = useState<any>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<AGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // create group
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);

  const load = async () => {
    if (!assignmentId) return;
    setLoading(true);
    const { data: a } = await supabase
      .from("assignments")
      .select("id, title, course_id, grouping_mode, gender_filter, gender_split, max_group_size, groups_locked")
      .eq("id", assignmentId)
      .single();
    setAssignment(a);

    if (!a) { setLoading(false); return; }

    const { data: cs } = await supabase
      .from("course_students")
      .select("student_id")
      .eq("course_id", (a as any).course_id);
    const sids = ((cs as any) ?? []).map((r: any) => r.student_id) as string[];
    let profs: Profile[] = [];
    if (sids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, national_id")
        .in("id", sids);
      profs = ((p as any) ?? []).map((x: any) => ({
        ...x,
        gender: genderFromNationalId(x.national_id),
      }));
    }

    const { data: gs } = await supabase
      .from("assignment_groups")
      .select("id, name, max_size, assignment_group_members(student_id)")
      .eq("assignment_id", assignmentId)
      .order("created_at");

    const gList: AGroup[] = ((gs as any) ?? []).map((g: any) => {
      const memIds = (g.assignment_group_members ?? []).map((m: any) => m.student_id);
      const memProfs = profs.filter((p) => memIds.includes(p.id));
      return { id: g.id, name: g.name, max_size: g.max_size, members: memProfs };
    });

    // filter by gender if needed
    const gf = (a as any).gender_filter as "any" | "male" | "female";
    const eligible = profs.filter((p) => gf === "any" ? true : p.gender === gf);
    setStudents(eligible);
    setGroups(gList);
    setLoading(false);
  };

  useEffect(() => { load(); }, [assignmentId]);

  const assignedIds = useMemo(
    () => new Set(groups.flatMap((g) => g.members.map((m) => m.id))),
    [groups]
  );
  const unassigned = students.filter((s) => !assignedIds.has(s.id));

  const sizeFor = (g: AGroup) => g.max_size ?? assignment?.max_group_size ?? null;

  const createGroup = async () => {
    if (!newName.trim()) return toast.error("اسم المجموعة مطلوب");
    setBusy(true);
    const { data: g, error } = await supabase
      .from("assignment_groups")
      .insert({
        assignment_id: assignmentId,
        name: newName.trim(),
        max_size: assignment?.max_group_size ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    if (newMembers.length > 0) {
      const rows = newMembers.map((sid) => ({
        group_id: (g as any).id,
        student_id: sid,
        assignment_id: assignmentId!,
      }));
      const { error: e2 } = await supabase.from("assignment_group_members").insert(rows);
      if (e2) toast.error(e2.message);
    }
    toast.success("تم إنشاء المجموعة");
    setOpenNew(false);
    setNewName("");
    setNewMembers([]);
    setBusy(false);
    load();
  };

  const removeGroup = async (gid: string) => {
    if (!confirm("حذف المجموعة وكل أعضائها؟")) return;
    const { error } = await supabase.from("assignment_groups").delete().eq("id", gid);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  const addMember = async (gid: string, sid: string) => {
    setBusy(true);
    const { error } = await supabase.from("assignment_group_members").insert({
      group_id: gid,
      student_id: sid,
      assignment_id: assignmentId!,
    });
    if (error) toast.error(error.message);
    else load();
    setBusy(false);
  };

  const removeMember = async (gid: string, sid: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("assignment_group_members")
      .delete()
      .eq("group_id", gid)
      .eq("student_id", sid);
    if (error) toast.error(error.message);
    else load();
    setBusy(false);
  };

  const clearAll = async () => {
    if (!confirm("حذف كل المجموعات والأعضاء لإعادة التقسيم؟")) return;
    setBusy(true);
    const ids = groups.map((g) => g.id);
    if (ids.length) {
      await supabase.from("assignment_groups").delete().in("id", ids);
    }
    setBusy(false);
    load();
  };

  const autoDistribute = async (mode: "random" | "alphabetical") => {
    const size = assignment?.max_group_size;
    if (!size || size < 1) return toast.error("حدد عدد الأعضاء في كل مجموعة من إعدادات الطلب");
    if (students.length === 0) return toast.error("لا يوجد طلاب مؤهلون");
    if (!confirm(`سيتم حذف المجموعات الحالية وإعادة التقسيم ${mode === "random" ? "عشوائياً" : "أبجدياً"}. متابعة؟`)) return;
    setBusy(true);

    // wipe existing
    const existingIds = groups.map((g) => g.id);
    if (existingIds.length) {
      await supabase.from("assignment_groups").delete().in("id", existingIds);
    }

    // order students
    const ordered = [...students];
    if (mode === "alphabetical") {
      ordered.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    } else {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }

    const groupCount = Math.ceil(ordered.length / size);
    for (let i = 0; i < groupCount; i++) {
      const slice = ordered.slice(i * size, (i + 1) * size);
      const { data: g, error } = await supabase
        .from("assignment_groups")
        .insert({
          assignment_id: assignmentId,
          name: `مجموعة ${i + 1}`,
          max_size: size,
        })
        .select("id")
        .single();
      if (error) { toast.error(error.message); break; }
      const rows = slice.map((s) => ({
        group_id: (g as any).id,
        student_id: s.id,
        assignment_id: assignmentId!,
      }));
      const { error: e2 } = await supabase.from("assignment_group_members").insert(rows);
      if (e2) { toast.error(e2.message); break; }
    }
    toast.success("تم التقسيم");
    setBusy(false);
    load();
  };

  const toggleLock = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("assignments")
      .update({ groups_locked: !assignment.groups_locked })
      .eq("id", assignmentId!);
    if (error) toast.error(error.message);
    else { toast.success(assignment.groups_locked ? "تم فتح القفل" : "تم القفل"); load(); }
    setBusy(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!assignment) {
    return (
      <AppLayout>
        <Card><CardContent className="py-12 text-center text-muted-foreground">طلب التسليم غير موجود</CardContent></Card>
      </AppLayout>
    );
  }

  const mode = assignment.grouping_mode as string;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`${baseRoute}/assignments`}><Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <Users2 className="h-6 w-6 text-primary" />
              مجموعات: {assignment.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2 text-sm">
              <Badge variant="outline">طريقة التقسيم: {mode === "random" ? "عشوائي" : mode === "alphabetical" ? "أبجدي" : mode === "manual" ? "يدوي" : mode === "student_self" ? "اختيار الطلاب" : "بدون"}</Badge>
              <Badge variant="outline">الجنس: {assignment.gender_filter === "male" ? "ذكور" : assignment.gender_filter === "female" ? "إناث" : "الجميع"}</Badge>
              <Badge variant="outline">الحد الأقصى لكل مجموعة: {assignment.max_group_size ?? "—"}</Badge>
              {assignment.groups_locked && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> مقفل</Badge>}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">أدوات التقسيم</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => autoDistribute("random")} disabled={busy}>
              <Shuffle className="h-4 w-4" /> توزيع عشوائي
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => autoDistribute("alphabetical")} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> توزيع أبجدي
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> مجموعة يدوية</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إنشاء مجموعة</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>اسم المجموعة *</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مجموعة 1" />
                  </div>
                  <div className="space-y-2">
                    <Label>الأعضاء (اختياري الآن)</Label>
                    <div className="max-h-64 overflow-auto border rounded-lg divide-y">
                      {unassigned.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">لا يوجد طلاب غير مُسندين</p>}
                      {unassigned.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                          <Checkbox
                            checked={newMembers.includes(s.id)}
                            onCheckedChange={(c) =>
                              setNewMembers((prev) => c ? [...prev, s.id] : prev.filter((x) => x !== s.id))
                            }
                          />
                          <span className="flex-1 text-sm">{s.full_name}</span>
                          <span className="text-xs text-muted-foreground">{genderLabel[s.gender ?? "unknown"]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createGroup} disabled={busy} className="gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2" onClick={toggleLock} disabled={busy}>
              {assignment.groups_locked ? <><Unlock className="h-4 w-4" /> فتح التعديل</> : <><Lock className="h-4 w-4" /> قفل المجموعات</>}
            </Button>
            {groups.length > 0 && (
              <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={clearAll} disabled={busy}>
                <Trash2 className="h-4 w-4" /> حذف الكل
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const cap = sizeFor(g);
            const full = cap !== null && g.members.length >= cap;
            return (
              <Card key={g.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {g.name}
                      <Badge variant={full ? "destructive" : "secondary"}>{g.members.length}{cap ? ` / ${cap}` : ""}</Badge>
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeGroup(g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {g.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">لا يوجد أعضاء</p>
                  ) : (
                    <ul className="divide-y border rounded-lg overflow-hidden">
                      {g.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.full_name}</p>
                            <p className="text-xs font-mono text-muted-foreground" dir="ltr">{m.national_id}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{genderLabel[m.gender ?? "unknown"]}</span>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-7 w-7" onClick={() => removeMember(g.id, m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!full && unassigned.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-primary">+ إضافة عضو</summary>
                      <div className="mt-2 max-h-48 overflow-auto border rounded-lg divide-y">
                        {unassigned.map((s) => (
                          <button
                            key={s.id}
                            className="w-full text-right p-2 text-sm hover:bg-muted/50 flex justify-between items-center"
                            onClick={() => addMember(g.id, s.id)}
                          >
                            <span>{s.full_name}</span>
                            <span className="text-xs text-muted-foreground">{genderLabel[s.gender ?? "unknown"]}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {unassigned.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">طلاب غير مُسندين ({unassigned.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {unassigned.map((s) => (
                  <li key={s.id} className="border rounded-lg p-2 text-sm">
                    <p className="font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{s.national_id}</p>
                    <p className="text-xs text-muted-foreground">{genderLabel[s.gender ?? "unknown"]}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminAssignmentGroups;