-- ===== Enums =====
CREATE TYPE public.grouping_mode AS ENUM ('none','random','alphabetical','manual','student_self');
CREATE TYPE public.gender_filter AS ENUM ('male','female','any');
CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','rejected','cancelled');

-- ===== Extend assignments =====
ALTER TABLE public.assignments
  ADD COLUMN grouping_mode public.grouping_mode NOT NULL DEFAULT 'none',
  ADD COLUMN gender_filter public.gender_filter NOT NULL DEFAULT 'any',
  ADD COLUMN max_group_size integer,
  ADD COLUMN groups_locked boolean NOT NULL DEFAULT false;

-- ===== assignment_groups =====
CREATE TABLE public.assignment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  name text NOT NULL,
  max_size integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignment_groups_assignment ON public.assignment_groups(assignment_id);

ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage assignment groups"
  ON public.assignment_groups FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors manage assignment groups"
  ON public.assignment_groups FOR ALL
  USING (public.supervises_assignment(auth.uid(), assignment_id))
  WITH CHECK (public.supervises_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students view their assignment groups"
  ON public.assignment_groups FOR SELECT
  USING (public.student_can_see_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students create groups in self mode"
  ON public.assignment_groups FOR INSERT
  WITH CHECK (
    public.student_can_see_assignment(auth.uid(), assignment_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.grouping_mode = 'student_self'
        AND a.groups_locked = false
    )
  );

-- ===== assignment_group_members =====
CREATE TABLE public.assignment_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX idx_agm_group ON public.assignment_group_members(group_id);
CREATE INDEX idx_agm_student ON public.assignment_group_members(student_id);

ALTER TABLE public.assignment_group_members ENABLE ROW LEVEL SECURITY;

-- helper SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION public.student_in_assignment_group(_user uuid, _group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_group_members
    WHERE group_id = _group_id AND student_id = _user
  )
$$;

CREATE OR REPLACE FUNCTION public.assignment_group_full(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    COALESCE(g.max_size, a.max_group_size) IS NOT NULL
    AND (SELECT count(*) FROM public.assignment_group_members m WHERE m.group_id = g.id)
        >= COALESCE(g.max_size, a.max_group_size)
  )
  FROM public.assignment_groups g
  JOIN public.assignments a ON a.id = g.assignment_id
  WHERE g.id = _group_id
$$;

CREATE POLICY "Admins manage assignment group members"
  ON public.assignment_group_members FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors manage assignment group members"
  ON public.assignment_group_members FOR ALL
  USING (public.supervises_assignment(auth.uid(), assignment_id))
  WITH CHECK (public.supervises_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students view members of their assignment groups"
  ON public.assignment_group_members FOR SELECT
  USING (public.student_can_see_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students self-join open groups"
  ON public.assignment_group_members FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND public.student_can_see_assignment(auth.uid(), assignment_id)
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.grouping_mode = 'student_self'
        AND a.groups_locked = false
    )
    AND NOT public.assignment_group_full(group_id)
  );

CREATE POLICY "Students leave their own membership"
  ON public.assignment_group_members FOR DELETE
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.grouping_mode = 'student_self'
        AND a.groups_locked = false
    )
  );

-- ===== group_invitations =====
CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (group_id, invitee_id, status)
);
CREATE INDEX idx_invites_invitee ON public.group_invitations(invitee_id, status);
CREATE INDEX idx_invites_group ON public.group_invitations(group_id);

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view invitations"
  ON public.group_invitations FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Supervisors view invitations"
  ON public.group_invitations FOR SELECT
  USING (public.supervises_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students view their invitations"
  ON public.group_invitations FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Students create invitations from their group"
  ON public.group_invitations FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
    AND public.student_in_assignment_group(auth.uid(), group_id)
    AND public.student_can_see_assignment(invitee_id, assignment_id)
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.grouping_mode = 'student_self'
        AND a.groups_locked = false
    )
    AND NOT public.assignment_group_full(group_id)
  );

CREATE POLICY "Invitee responds to invitation"
  ON public.group_invitations FOR UPDATE
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "Inviter or invitee deletes invitation"
  ON public.group_invitations FOR DELETE
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());
