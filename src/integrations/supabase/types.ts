export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignment_group_members: {
        Row: {
          assignment_id: string
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_group_members_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_groups: {
        Row: {
          assignment_id: string
          created_at: string
          created_by: string | null
          id: string
          max_size: number | null
          name: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_size?: number | null
          name: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_size?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_groups_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          gender_filter: Database["public"]["Enums"]["gender_filter"]
          gender_split: Database["public"]["Enums"]["gender_split"]
          group_id: string | null
          group_submission_mode: Database["public"]["Enums"]["group_submission_mode"]
          grouping_mode: Database["public"]["Enums"]["grouping_mode"]
          groups_locked: boolean
          id: string
          late_policy: Database["public"]["Enums"]["late_policy"]
          max_group_size: number | null
          scope: Database["public"]["Enums"]["assignment_scope"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          gender_filter?: Database["public"]["Enums"]["gender_filter"]
          gender_split?: Database["public"]["Enums"]["gender_split"]
          group_id?: string | null
          group_submission_mode?: Database["public"]["Enums"]["group_submission_mode"]
          grouping_mode?: Database["public"]["Enums"]["grouping_mode"]
          groups_locked?: boolean
          id?: string
          late_policy?: Database["public"]["Enums"]["late_policy"]
          max_group_size?: number | null
          scope?: Database["public"]["Enums"]["assignment_scope"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          gender_filter?: Database["public"]["Enums"]["gender_filter"]
          gender_split?: Database["public"]["Enums"]["gender_split"]
          group_id?: string | null
          group_submission_mode?: Database["public"]["Enums"]["group_submission_mode"]
          grouping_mode?: Database["public"]["Enums"]["grouping_mode"]
          groups_locked?: boolean
          id?: string
          late_policy?: Database["public"]["Enums"]["late_policy"]
          max_group_size?: number | null
          scope?: Database["public"]["Enums"]["assignment_scope"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      course_students: {
        Row: {
          course_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_supervisors: {
        Row: {
          course_id: string
          created_at: string
          id: string
          supervisor_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          supervisor_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_supervisors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_invitations: {
        Row: {
          assignment_id: string
          created_at: string
          group_id: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          assignment_id: string
          created_at?: string
          group_id: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          assignment_id?: string
          created_at?: string
          group_id?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          national_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          national_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          national_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_password: string | null
          email: string | null
          full_name: string
          id: string
          must_change_password: boolean
          national_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_password?: string | null
          email?: string | null
          full_name: string
          id: string
          must_change_password?: boolean
          national_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_password?: string | null
          email?: string | null
          full_name?: string
          id?: string
          must_change_password?: boolean
          national_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          file_name: string
          file_path: string
          file_size: number | null
          group_id: string | null
          id: string
          is_late: boolean
          last_edited_by: string | null
          mime_type: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          group_id?: string | null
          id?: string
          is_late?: boolean
          last_edited_by?: string | null
          mime_type?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          group_id?: string | null
          id?: string
          is_late?: boolean
          last_edited_by?: string | null
          mime_type?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assignment_group_full: { Args: { _group_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
      student_can_see_assignment: {
        Args: { _assignment_id: string; _user: string }
        Returns: boolean
      }
      student_can_submit_assignment: {
        Args: { _assignment_id: string; _user: string }
        Returns: boolean
      }
      student_in_assignment_group: {
        Args: { _group_id: string; _user: string }
        Returns: boolean
      }
      supervises_assignment: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
      }
      supervises_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student" | "supervisor"
      assignment_scope: "course" | "group"
      gender_filter: "male" | "female" | "any"
      gender_split: "mixed" | "separated"
      group_submission_mode: "per_student" | "one_per_group"
      grouping_mode:
        | "none"
        | "random"
        | "alphabetical"
        | "manual"
        | "student_self"
      invitation_status: "pending" | "accepted" | "rejected" | "cancelled"
      late_policy: "block" | "allow_marked_late"
      submission_status:
        | "pending"
        | "approved"
        | "rejected"
        | "resubmit_requested"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student", "supervisor"],
      assignment_scope: ["course", "group"],
      gender_filter: ["male", "female", "any"],
      gender_split: ["mixed", "separated"],
      group_submission_mode: ["per_student", "one_per_group"],
      grouping_mode: [
        "none",
        "random",
        "alphabetical",
        "manual",
        "student_self",
      ],
      invitation_status: ["pending", "accepted", "rejected", "cancelled"],
      late_policy: ["block", "allow_marked_late"],
      submission_status: [
        "pending",
        "approved",
        "rejected",
        "resubmit_requested",
      ],
    },
  },
} as const
