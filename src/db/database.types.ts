export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      events: {
        Row: {
          actor_user_id: string;
          duration_ms: number | null;
          end_date: string | null;
          event_id: string;
          event_type: string;
          inequality: number | null;
          members_count: number | null;
          metadata: Json;
          occurred_at: string;
          range_days: number | null;
          start_date: string | null;
          team_id: string;
          unassigned_count: number | null;
        };
        Insert: {
          actor_user_id: string;
          duration_ms?: number | null;
          end_date?: string | null;
          event_id?: string;
          event_type: string;
          inequality?: number | null;
          members_count?: number | null;
          metadata?: Json;
          occurred_at?: string;
          range_days?: number | null;
          start_date?: string | null;
          team_id: string;
          unassigned_count?: number | null;
        };
        Update: {
          actor_user_id?: string;
          duration_ms?: number | null;
          end_date?: string | null;
          event_id?: string;
          event_type?: string;
          inequality?: number | null;
          members_count?: number | null;
          metadata?: Json;
          occurred_at?: string;
          range_days?: number | null;
          start_date?: string | null;
          team_id?: string;
          unassigned_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_id"];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          initial_on_call_count: number;
          member_id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          initial_on_call_count: number;
          member_id?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          initial_on_call_count?: number;
          member_id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_id"];
          },
        ];
      };
      plan_assignments: {
        Row: {
          created_at: string;
          day: string;
          member_id: string | null;
          plan_id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          member_id?: string | null;
          plan_id: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          member_id?: string | null;
          plan_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_assignments_team_id_member_id_fkey";
            columns: ["team_id", "member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["team_id", "member_id"];
          },
          {
            foreignKeyName: "plan_assignments_team_id_plan_id_fkey";
            columns: ["team_id", "plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["team_id", "plan_id"];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          created_by: string;
          date_range: unknown;
          end_date: string;
          plan_id: string;
          start_date: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          date_range?: unknown;
          end_date: string;
          plan_id?: string;
          start_date: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          date_range?: unknown;
          end_date?: string;
          plan_id?: string;
          start_date?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          created_at: string;
          max_saved_count: number;
          name: string;
          owner_id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          max_saved_count?: number;
          name?: string;
          owner_id: string;
          team_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          max_saved_count?: number;
          name?: string;
          owner_id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      unavailabilities: {
        Row: {
          created_at: string;
          day: string;
          member_id: string;
          team_id: string;
          unavailability_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          member_id: string;
          team_id: string;
          unavailability_id?: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          member_id?: string;
          team_id?: string;
          unavailability_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unavailabilities_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_id"];
          },
          {
            foreignKeyName: "unavailabilities_team_id_member_id_fkey";
            columns: ["team_id", "member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["team_id", "member_id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
