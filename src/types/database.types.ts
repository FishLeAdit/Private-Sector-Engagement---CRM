// Generated from migrations executed in local PostgreSQL (PGlite). Do not edit.
// Regenerate: npm run db:types. Hosted Supabase schema is not inspected by this command.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string;
          activity_type: string;
          work_category: string;
          contact_id: string | null;
          opportunity_id: string | null;
          meeting_id: string | null;
          related_person_name: string | null;
          related_organization_name: string | null;
          owner_id: string;
          created_by: string;
          status: string;
          remaining_work: string | null;
          occurred_at: string | null;
          notes: string | null;
          drive_urls: string[];
          estimated_nonmonetary_value: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          activity_type: string;
          work_category?: string;
          contact_id?: string | null;
          opportunity_id?: string | null;
          meeting_id?: string | null;
          related_person_name?: string | null;
          related_organization_name?: string | null;
          owner_id: string;
          created_by?: string;
          status?: string;
          remaining_work?: string | null;
          occurred_at?: string | null;
          notes?: string | null;
          drive_urls?: string[];
          estimated_nonmonetary_value?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          activity_type?: string;
          work_category?: string;
          contact_id?: string | null;
          opportunity_id?: string | null;
          meeting_id?: string | null;
          related_person_name?: string | null;
          related_organization_name?: string | null;
          owner_id?: string;
          created_by?: string;
          status?: string;
          remaining_work?: string | null;
          occurred_at?: string | null;
          notes?: string | null;
          drive_urls?: string[];
          estimated_nonmonetary_value?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "activities_contact_id_fkey",
            "columns": [
              "contact_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "activities_created_by_fkey",
            "columns": [
              "created_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "activities_meeting_id_fkey",
            "columns": [
              "meeting_id"
            ],
            "referencedRelation": "meetings",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "activities_opportunity_id_fkey",
            "columns": [
              "opportunity_id"
            ],
            "referencedRelation": "opportunities",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "activities_owner_id_fkey",
            "columns": [
              "owner_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          entity: string;
          entity_id: string;
          action: string;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          entity: string;
          entity_id: string;
          action: string;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          entity?: string;
          entity_id?: string;
          action?: string;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "audit_logs_actor_id_fkey",
            "columns": [
              "actor_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      contacts: {
        Row: {
          id: string;
          kind: string;
          name: string;
          email: string | null;
          phone: string | null;
          email_normalized: string | null;
          phone_normalized: string | null;
          company_id: string | null;
          designation: string | null;
          website: string | null;
          industry: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          email_normalized?: never;
          phone_normalized?: never;
          company_id?: string | null;
          designation?: string | null;
          website?: string | null;
          industry?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          email_normalized?: never;
          phone_normalized?: never;
          company_id?: string | null;
          designation?: string | null;
          website?: string | null;
          industry?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "contacts_company_id_fkey",
            "columns": [
              "company_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "contacts_created_by_fkey",
            "columns": [
              "created_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      contribution_categories: {
        Row: {
          id: string;
          code: string;
          name: string;
          active: boolean;
          is_provisional: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          active?: boolean;
          is_provisional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          active?: boolean;
          is_provisional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          contact_id: string | null;
          opportunity_id: string | null;
          title: string;
          scheduled_at: string;
          status: string;
          description: string | null;
          owner_id: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          opportunity_id?: string | null;
          title: string;
          scheduled_at: string;
          status?: string;
          description?: string | null;
          owner_id: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          opportunity_id?: string | null;
          title?: string;
          scheduled_at?: string;
          status?: string;
          description?: string | null;
          owner_id?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "meetings_contact_id_fkey",
            "columns": [
              "contact_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "meetings_created_by_fkey",
            "columns": [
              "created_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "meetings_opportunity_id_fkey",
            "columns": [
              "opportunity_id"
            ],
            "referencedRelation": "opportunities",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "meetings_owner_id_fkey",
            "columns": [
              "owner_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      opportunities: {
        Row: {
          id: string;
          deal_name: string;
          contact_id: string;
          primary_contact_id: string | null;
          secondary_contact_id: string | null;
          owner_id: string;
          stage_id: string;
          contribution_type: string;
          contribution_category_id: string;
          expected_amount: number;
          operational_budget: number | null;
          currency: string;
          payment_interval: string | null;
          expected_close_at: string | null;
          country: string | null;
          description: string | null;
          notes: string | null;
          drive_urls: string[];
          valuation_note: string | null;
          valuation_reference_url: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deal_name: string;
          contact_id: string;
          primary_contact_id?: string | null;
          secondary_contact_id?: string | null;
          owner_id: string;
          stage_id: string;
          contribution_type: string;
          contribution_category_id: string;
          expected_amount: number;
          operational_budget?: number | null;
          currency?: string;
          payment_interval?: string | null;
          expected_close_at?: string | null;
          country?: string | null;
          description?: string | null;
          notes?: string | null;
          drive_urls?: string[];
          valuation_note?: string | null;
          valuation_reference_url?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deal_name?: string;
          contact_id?: string;
          primary_contact_id?: string | null;
          secondary_contact_id?: string | null;
          owner_id?: string;
          stage_id?: string;
          contribution_type?: string;
          contribution_category_id?: string;
          expected_amount?: number;
          operational_budget?: number | null;
          currency?: string;
          payment_interval?: string | null;
          expected_close_at?: string | null;
          country?: string | null;
          description?: string | null;
          notes?: string | null;
          drive_urls?: string[];
          valuation_note?: string | null;
          valuation_reference_url?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "opportunities_contact_id_fkey",
            "columns": [
              "contact_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_contribution_category_id_fkey",
            "columns": [
              "contribution_category_id"
            ],
            "referencedRelation": "contribution_categories",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_created_by_fkey",
            "columns": [
              "created_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_owner_id_fkey",
            "columns": [
              "owner_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_primary_contact_id_fkey",
            "columns": [
              "primary_contact_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_secondary_contact_id_fkey",
            "columns": [
              "secondary_contact_id"
            ],
            "referencedRelation": "contacts",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "opportunities_stage_id_fkey",
            "columns": [
              "stage_id"
            ],
            "referencedRelation": "pipeline_stages",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      pipeline_stages: {
        Row: {
          id: string;
          name: string;
          position: number;
          is_closed: boolean;
          outcome: string | null;
          is_provisional: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          position: number;
          is_closed?: boolean;
          outcome?: string | null;
          is_provisional?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          is_closed?: boolean;
          outcome?: string | null;
          is_provisional?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          department: string;
          role: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          department?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          department?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recognized_contributions: {
        Row: {
          id: string;
          opportunity_id: string;
          employee_id: string;
          target_vertical_id: string | null;
          amount: number;
          currency: string;
          recognized_at: string;
          contribution_type: string;
          approved_value_note: string | null;
          valuation_reference_url: string | null;
          notes: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          employee_id: string;
          target_vertical_id?: string | null;
          amount: number;
          currency?: string;
          recognized_at: string;
          contribution_type: string;
          approved_value_note?: string | null;
          valuation_reference_url?: string | null;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          opportunity_id?: string;
          employee_id?: string;
          target_vertical_id?: string | null;
          amount?: number;
          currency?: string;
          recognized_at?: string;
          contribution_type?: string;
          approved_value_note?: string | null;
          valuation_reference_url?: string | null;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "recognized_contributions_employee_id_fkey",
            "columns": [
              "employee_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "recognized_contributions_opportunity_id_fkey",
            "columns": [
              "opportunity_id"
            ],
            "referencedRelation": "opportunities",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "recognized_contributions_recorded_by_fkey",
            "columns": [
              "recorded_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "recognized_contributions_target_vertical_id_fkey",
            "columns": [
              "target_vertical_id"
            ],
            "referencedRelation": "target_verticals",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      target_allocations: {
        Row: {
          id: string;
          plan_id: string;
          quarter: number;
          employee_id: string;
          vertical_id: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          quarter: number;
          employee_id: string;
          vertical_id: string;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          quarter?: number;
          employee_id?: string;
          vertical_id?: string;
          amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "target_allocations_employee_id_fkey",
            "columns": [
              "employee_id"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "target_allocations_quarter_fkey",
            "columns": [
              "plan_id",
              "quarter"
            ],
            "referencedRelation": "target_quarters",
            "referencedColumns": [
              "plan_id",
              "quarter"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "target_allocations_vertical_id_fkey",
            "columns": [
              "vertical_id"
            ],
            "referencedRelation": "target_verticals",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      target_plans: {
        Row: {
          id: string;
          year: number;
          currency: string;
          annual_amount: number;
          status: string;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          currency?: string;
          annual_amount: number;
          status?: string;
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          currency?: string;
          annual_amount?: number;
          status?: string;
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "target_plans_approved_by_fkey",
            "columns": [
              "approved_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          },
          {
            "foreignKeyName": "target_plans_created_by_fkey",
            "columns": [
              "created_by"
            ],
            "referencedRelation": "profiles",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      target_quarters: {
        Row: {
          plan_id: string;
          quarter: number;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          plan_id: string;
          quarter: number;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_id?: string;
          quarter?: number;
          amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            "foreignKeyName": "target_quarters_plan_id_fkey",
            "columns": [
              "plan_id"
            ],
            "referencedRelation": "target_plans",
            "referencedColumns": [
              "id"
            ],
            "isOneToOne": false
          }
        ];
      };
      target_verticals: {
        Row: {
          id: string;
          code: string;
          name: string;
          active: boolean;
          is_provisional: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          active?: boolean;
          is_provisional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          active?: boolean;
          is_provisional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      approve_target_plan: { Args: { p_plan_id: string }; Returns: string };
      valid_http_url: { Args: { value: string }; Returns: boolean };
      valid_http_urls: { Args: { values_to_check: string[] }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Tables<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];
