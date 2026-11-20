// Hand-generated from supabase/migrations to match `supabase gen types typescript`.
// Regenerate with `npm run db:types` against the linked Supabase project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          locale: string;
          platform_role: Database["public"]["Enums"]["app_platform_role"];
          safety_score: number;
          created_at: string;
          updated_at: string;
          save_history: boolean;
          notify_email: boolean;
          notify_in_app: boolean;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          locale?: string;
          platform_role?: Database["public"]["Enums"]["app_platform_role"];
          safety_score?: number;
          created_at?: string;
          updated_at?: string;
          save_history?: boolean;
          notify_email?: boolean;
          notify_in_app?: boolean;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          locale?: string;
          platform_role?: Database["public"]["Enums"]["app_platform_role"];
          safety_score?: number;
          created_at?: string;
          updated_at?: string;
          save_history?: boolean;
          notify_email?: boolean;
          notify_in_app?: boolean;
        };
        Relationships: [
        ];
      };
      organizations: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["org_type"];
          name: string;
          slug: string;
          country: string;
          plan: string;
          created_at: string;
          notification_emails: string[];
          retention_days: number;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["org_type"];
          name: string;
          slug: string;
          country?: string;
          plan?: string;
          created_at?: string;
          notification_emails?: string[];
          retention_days?: number;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["org_type"];
          name?: string;
          slug?: string;
          country?: string;
          plan?: string;
          created_at?: string;
          notification_emails?: string[];
          retention_days?: number;
        };
        Relationships: [
        ];
      };
      organization_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["org_member_role"];
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      institutions: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sector: string;
          organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          sector?: string;
          organization_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          sector?: string;
          organization_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institutions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      official_domains: {
        Row: {
          id: string;
          institution_id: string;
          domain: string;
          verified: boolean;
        };
        Insert: {
          id?: string;
          institution_id: string;
          domain: string;
          verified?: boolean;
        };
        Update: {
          id?: string;
          institution_id?: string;
          domain?: string;
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "official_domains_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      official_channels: {
        Row: {
          id: string;
          institution_id: string;
          kind: string;
          value: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          kind: string;
          value: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          kind?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "official_channels_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          id: string;
          code: string;
          tactic: string;
          institution_id: string | null;
          imitated_name: string | null;
          first_seen: string | null;
          last_seen: string | null;
          message_count: number;
          status: Database["public"]["Enums"]["campaign_status"];
          severity: Database["public"]["Enums"]["severity"];
          owner_id: string | null;
          summary: string | null;
          is_public: boolean;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          tactic: string;
          institution_id?: string | null;
          imitated_name?: string | null;
          first_seen?: string | null;
          last_seen?: string | null;
          message_count?: number;
          status?: Database["public"]["Enums"]["campaign_status"];
          severity?: Database["public"]["Enums"]["severity"];
          owner_id?: string | null;
          summary?: string | null;
          is_public?: boolean;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          tactic?: string;
          institution_id?: string | null;
          imitated_name?: string | null;
          first_seen?: string | null;
          last_seen?: string | null;
          message_count?: number;
          status?: Database["public"]["Enums"]["campaign_status"];
          severity?: Database["public"]["Enums"]["severity"];
          owner_id?: string | null;
          summary?: string | null;
          is_public?: boolean;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      domains: {
        Row: {
          id: string;
          domain: string;
          class: Database["public"]["Enums"]["domain_class"];
          imitates_domain: string | null;
          imitates_institution_id: string | null;
          rule: string | null;
          registered_at: string | null;
          age_days: number | null;
          registrar: string | null;
          nameserver: string | null;
          hosting_country: string | null;
          privacy: boolean | null;
          in_ct_log: boolean;
          risk_score: number | null;
          status: string;
          first_seen_at: string;
        };
        Insert: {
          id?: string;
          domain: string;
          class?: Database["public"]["Enums"]["domain_class"];
          imitates_domain?: string | null;
          imitates_institution_id?: string | null;
          rule?: string | null;
          registered_at?: string | null;
          age_days?: number | null;
          registrar?: string | null;
          nameserver?: string | null;
          hosting_country?: string | null;
          privacy?: boolean | null;
          in_ct_log?: boolean;
          risk_score?: number | null;
          status?: string;
          first_seen_at?: string;
        };
        Update: {
          id?: string;
          domain?: string;
          class?: Database["public"]["Enums"]["domain_class"];
          imitates_domain?: string | null;
          imitates_institution_id?: string | null;
          rule?: string | null;
          registered_at?: string | null;
          age_days?: number | null;
          registrar?: string | null;
          nameserver?: string | null;
          hosting_country?: string | null;
          privacy?: boolean | null;
          in_ct_log?: boolean;
          risk_score?: number | null;
          status?: string;
          first_seen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "domains_imitates_institution_id_fkey";
            columns: ["imitates_institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_domains: {
        Row: {
          campaign_id: string;
          domain_id: string;
        };
        Insert: {
          campaign_id: string;
          domain_id: string;
        };
        Update: {
          campaign_id?: string;
          domain_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_domains_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_domains_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
        ];
      };
      certificates: {
        Row: {
          cert_id: string;
          domain_id: string | null;
          san: string[];
          issuer: string | null;
          not_before: string | null;
          not_after: string | null;
          label: Database["public"]["Enums"]["domain_class"] | null;
          imitated_domain: string | null;
          campaign_id: string | null;
        };
        Insert: {
          cert_id: string;
          domain_id?: string | null;
          san?: string[];
          issuer?: string | null;
          not_before?: string | null;
          not_after?: string | null;
          label?: Database["public"]["Enums"]["domain_class"] | null;
          imitated_domain?: string | null;
          campaign_id?: string | null;
        };
        Update: {
          cert_id?: string;
          domain_id?: string | null;
          san?: string[];
          issuer?: string | null;
          not_before?: string | null;
          not_after?: string | null;
          label?: Database["public"]["Enums"]["domain_class"] | null;
          imitated_domain?: string | null;
          campaign_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          external_id: string | null;
          channel: Database["public"]["Enums"]["msg_channel"];
          language: string;
          sender_masked: string | null;
          subject: string | null;
          body_masked: string;
          body_hash: string;
          urls: string[];
          label: Database["public"]["Enums"]["msg_label"];
          score: number | null;
          flag: Database["public"]["Enums"]["flag_level"] | null;
          campaign_id: string | null;
          institution_id: string | null;
          tactic: string | null;
          template_id: string | null;
          received_at: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          channel: Database["public"]["Enums"]["msg_channel"];
          language: string;
          sender_masked?: string | null;
          subject?: string | null;
          body_masked: string;
          body_hash: string;
          urls?: string[];
          label?: Database["public"]["Enums"]["msg_label"];
          score?: number | null;
          flag?: Database["public"]["Enums"]["flag_level"] | null;
          campaign_id?: string | null;
          institution_id?: string | null;
          tactic?: string | null;
          template_id?: string | null;
          received_at?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          channel?: Database["public"]["Enums"]["msg_channel"];
          language?: string;
          sender_masked?: string | null;
          subject?: string | null;
          body_masked?: string;
          body_hash?: string;
          urls?: string[];
          label?: Database["public"]["Enums"]["msg_label"];
          score?: number | null;
          flag?: Database["public"]["Enums"]["flag_level"] | null;
          campaign_id?: string | null;
          institution_id?: string | null;
          tactic?: string | null;
          template_id?: string | null;
          received_at?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      iocs: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["ioc_type"];
          value: string;
          campaign_id: string | null;
          source: string;
          first_seen: string;
          last_seen: string;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["ioc_type"];
          value: string;
          campaign_id?: string | null;
          source?: string;
          first_seen?: string;
          last_seen?: string;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["ioc_type"];
          value?: string;
          campaign_id?: string | null;
          source?: string;
          first_seen?: string;
          last_seen?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iocs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      known_hashes: {
        Row: {
          hash: string;
          kind: string;
          flag: Database["public"]["Enums"]["flag_level"];
          campaign_id: string | null;
          seen_count: number;
          last_seen: string;
        };
        Insert: {
          hash: string;
          kind: string;
          flag: Database["public"]["Enums"]["flag_level"];
          campaign_id?: string | null;
          seen_count?: number;
          last_seen?: string;
        };
        Update: {
          hash?: string;
          kind?: string;
          flag?: Database["public"]["Enums"]["flag_level"];
          campaign_id?: string | null;
          seen_count?: number;
          last_seen?: string;
        };
        Relationships: [
          {
            foreignKeyName: "known_hashes_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      checks: {
        Row: {
          id: string;
          input_kind: string;
          input_hash: string;
          score: number;
          flag: Database["public"]["Enums"]["flag_level"];
          reasons: Json;
          campaign_id: string | null;
          model_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          input_kind: string;
          input_hash: string;
          score: number;
          flag: Database["public"]["Enums"]["flag_level"];
          reasons?: Json;
          campaign_id?: string | null;
          model_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          input_kind?: string;
          input_hash?: string;
          score?: number;
          flag?: Database["public"]["Enums"]["flag_level"];
          reasons?: Json;
          campaign_id?: string | null;
          model_version?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checks_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          protocol: string;
          source: Database["public"]["Enums"]["report_source"];
          status: Database["public"]["Enums"]["report_status"];
          channel: Database["public"]["Enums"]["msg_channel"] | null;
          score: number | null;
          flag: Database["public"]["Enums"]["flag_level"] | null;
          reasons: Json;
          message_id: string | null;
          campaign_id: string | null;
          reporter_id: string | null;
          reporter_org_id: string | null;
          reporter_contact: string | null;
          tracking_token_hash: string | null;
          consent_signal_report: boolean;
          assigned_to: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          protocol?: string;
          source: Database["public"]["Enums"]["report_source"];
          status?: Database["public"]["Enums"]["report_status"];
          channel?: Database["public"]["Enums"]["msg_channel"] | null;
          score?: number | null;
          flag?: Database["public"]["Enums"]["flag_level"] | null;
          reasons?: Json;
          message_id?: string | null;
          campaign_id?: string | null;
          reporter_id?: string | null;
          reporter_org_id?: string | null;
          reporter_contact?: string | null;
          tracking_token_hash?: string | null;
          consent_signal_report?: boolean;
          assigned_to?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          protocol?: string;
          source?: Database["public"]["Enums"]["report_source"];
          status?: Database["public"]["Enums"]["report_status"];
          channel?: Database["public"]["Enums"]["msg_channel"] | null;
          score?: number | null;
          flag?: Database["public"]["Enums"]["flag_level"] | null;
          reasons?: Json;
          message_id?: string | null;
          campaign_id?: string | null;
          reporter_id?: string | null;
          reporter_org_id?: string | null;
          reporter_contact?: string | null;
          tracking_token_hash?: string | null;
          consent_signal_report?: boolean;
          assigned_to?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_org_id_fkey";
            columns: ["reporter_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_events: {
        Row: {
          id: string;
          report_id: string;
          actor_id: string | null;
          kind: string;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          actor_id?: string | null;
          kind: string;
          data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          actor_id?: string | null;
          kind?: string;
          data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_notes: {
        Row: {
          id: string;
          campaign_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_notes_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      extension_installs: {
        Row: {
          id: string;
          install_hash: string;
          user_id: string | null;
          auto_submit: boolean;
          consent_at: string | null;
          version: string | null;
          last_seen: string;
          created_at: string;
          token_hash: string | null;
        };
        Insert: {
          id?: string;
          install_hash: string;
          user_id?: string | null;
          auto_submit?: boolean;
          consent_at?: string | null;
          version?: string | null;
          last_seen?: string;
          created_at?: string;
          token_hash?: string | null;
        };
        Update: {
          id?: string;
          install_hash?: string;
          user_id?: string | null;
          auto_submit?: boolean;
          consent_at?: string | null;
          version?: string | null;
          last_seen?: string;
          created_at?: string;
          token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "extension_installs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      extension_reports: {
        Row: {
          id: string;
          install_id: string;
          report_id: string;
          signals: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          install_id: string;
          report_id: string;
          signals: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          install_id?: string;
          report_id?: string;
          signals?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extension_reports_install_id_fkey";
            columns: ["install_id"];
            isOneToOne: false;
            referencedRelation: "extension_installs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "extension_reports_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      recipients: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["notice_type"];
          name: string;
          abuse_email: string;
          match_pattern: string | null;
          sla_hours: number;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["notice_type"];
          name: string;
          abuse_email: string;
          match_pattern?: string | null;
          sla_hours?: number;
        };
        Update: {
          id?: string;
          kind?: Database["public"]["Enums"]["notice_type"];
          name?: string;
          abuse_email?: string;
          match_pattern?: string | null;
          sla_hours?: number;
        };
        Relationships: [
        ];
      };
      templates: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["notice_type"];
          locale: string;
          version: number;
          subject: string;
          body: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["notice_type"];
          locale: string;
          version?: number;
          subject: string;
          body: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          kind?: Database["public"]["Enums"]["notice_type"];
          locale?: string;
          version?: number;
          subject?: string;
          body?: string;
          active?: boolean;
        };
        Relationships: [
        ];
      };
      takedown_notices: {
        Row: {
          id: string;
          protocol: string;
          campaign_id: string;
          domain_id: string | null;
          kind: Database["public"]["Enums"]["notice_type"];
          recipient_id: string | null;
          status: Database["public"]["Enums"]["notice_status"];
          subject: string;
          body: string;
          evidence_path: string | null;
          created_by: string;
          approved_by: string | null;
          sent_at: string | null;
          due_at: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          protocol?: string;
          campaign_id: string;
          domain_id?: string | null;
          kind: Database["public"]["Enums"]["notice_type"];
          recipient_id?: string | null;
          status?: Database["public"]["Enums"]["notice_status"];
          subject: string;
          body: string;
          evidence_path?: string | null;
          created_by: string;
          approved_by?: string | null;
          sent_at?: string | null;
          due_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          protocol?: string;
          campaign_id?: string;
          domain_id?: string | null;
          kind?: Database["public"]["Enums"]["notice_type"];
          recipient_id?: string | null;
          status?: Database["public"]["Enums"]["notice_status"];
          subject?: string;
          body?: string;
          evidence_path?: string | null;
          created_by?: string;
          approved_by?: string | null;
          sent_at?: string | null;
          due_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "takedown_notices_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takedown_notices_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takedown_notices_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "recipients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takedown_notices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takedown_notices_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notice_events: {
        Row: {
          id: string;
          notice_id: string;
          actor_id: string | null;
          kind: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          notice_id: string;
          actor_id?: string | null;
          kind: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          notice_id?: string;
          actor_id?: string | null;
          kind?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notice_events_notice_id_fkey";
            columns: ["notice_id"];
            isOneToOne: false;
            referencedRelation: "takedown_notices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notice_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          id: string;
          title: string;
          campaign_id: string | null;
          status: string;
          priority: Database["public"]["Enums"]["severity"];
          assignee_id: string | null;
          due_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          campaign_id?: string | null;
          status?: string;
          priority?: Database["public"]["Enums"]["severity"];
          assignee_id?: string | null;
          due_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          campaign_id?: string | null;
          status?: string;
          priority?: Database["public"]["Enums"]["severity"];
          assignee_id?: string | null;
          due_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      advisories: {
        Row: {
          id: string;
          slug: string;
          title_sq: string;
          title_en: string;
          body_sq: string;
          body_en: string;
          campaign_id: string | null;
          severity: Database["public"]["Enums"]["severity"];
          status: string;
          published_at: string | null;
          created_by: string;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          title_sq: string;
          title_en: string;
          body_sq: string;
          body_en: string;
          campaign_id?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          status?: string;
          published_at?: string | null;
          created_by: string;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          title_sq?: string;
          title_en?: string;
          body_sq?: string;
          body_en?: string;
          campaign_id?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          status?: string;
          published_at?: string | null;
          created_by?: string;
          approved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "advisories_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisories_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisories_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocklist_entries: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["ioc_type"];
          value: string;
          reason: string | null;
          campaign_id: string | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["ioc_type"];
          value: string;
          reason?: string | null;
          campaign_id?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["ioc_type"];
          value?: string;
          reason?: string | null;
          campaign_id?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocklist_entries_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocklist_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_rules: {
        Row: {
          id: string;
          name: string;
          condition: Json;
          channel: string;
          active: boolean;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          condition: Json;
          channel?: string;
          active?: boolean;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          condition?: Json;
          channel?: string;
          active?: boolean;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alert_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_labels: {
        Row: {
          id: string;
          report_id: string | null;
          message_id: string | null;
          analyst_id: string;
          predicted: Database["public"]["Enums"]["msg_label"] | null;
          actual: Database["public"]["Enums"]["msg_label"];
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          message_id?: string | null;
          analyst_id: string;
          predicted?: Database["public"]["Enums"]["msg_label"] | null;
          actual: Database["public"]["Enums"]["msg_label"];
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          message_id?: string | null;
          analyst_id?: string;
          predicted?: Database["public"]["Enums"]["msg_label"] | null;
          actual?: Database["public"]["Enums"]["msg_label"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_labels_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_labels_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_labels_analyst_id_fkey";
            columns: ["analyst_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      model_versions: {
        Row: {
          id: string;
          name: string;
          version: string;
          metrics: Json;
          artifact_path: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          version: string;
          metrics?: Json;
          artifact_path?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          version?: string;
          metrics?: Json;
          artifact_path?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_assets: {
        Row: {
          id: string;
          org_id: string;
          kind: string;
          value: string;
          verified_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          kind: string;
          value: string;
          verified_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          kind?: string;
          value?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_assets_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_alerts: {
        Row: {
          id: string;
          org_id: string;
          domain_id: string | null;
          campaign_id: string | null;
          severity: Database["public"]["Enums"]["severity"];
          title: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          domain_id?: string | null;
          campaign_id?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          title: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          domain_id?: string | null;
          campaign_id?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          title?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_alerts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_alerts_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_alerts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      simulations: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          template_key: string;
          status: string;
          sent: number;
          opened: number;
          clicked: number;
          reported: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          template_key: string;
          status?: string;
          sent?: number;
          opened?: number;
          clicked?: number;
          reported?: number;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          template_key?: string;
          status?: string;
          sent?: number;
          opened?: number;
          clicked?: number;
          reported?: number;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          scopes: string[];
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          scopes?: string[];
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          prefix?: string;
          key_hash?: string;
          scopes?: string[];
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          data: Json;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          data?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          data?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      outbox: {
        Row: {
          id: string;
          to_address: string;
          subject: string;
          body: string;
          kind: string;
          entity: string | null;
          entity_id: string | null;
          simulated: boolean;
          sent_at: string;
        };
        Insert: {
          id?: string;
          to_address: string;
          subject: string;
          body: string;
          kind?: string;
          entity?: string | null;
          entity_id?: string | null;
          simulated?: boolean;
          sent_at?: string;
        };
        Update: {
          id?: string;
          to_address?: string;
          subject?: string;
          body?: string;
          kind?: string;
          entity?: string | null;
          entity_id?: string | null;
          simulated?: boolean;
          sent_at?: string;
        };
        Relationships: [
        ];
      };
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          hits: number;
        };
        Insert: {
          key: string;
          window_start: string;
          hits?: number;
        };
        Update: {
          key?: string;
          window_start?: string;
          hits?: number;
        };
        Relationships: [
        ];
      };
      user_check_links: {
        Row: {
          user_id: string;
          check_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          check_id: string;
          kind: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          check_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_check_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_check_links_check_id_fkey";
            columns: ["check_id"];
            isOneToOne: false;
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
        ];
      };
      user_follows: {
        Row: {
          user_id: string;
          institution_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          institution_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          institution_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_follows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_follows_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_watch_items: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          value_hash: string;
          label: string;
          last_match_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          value_hash: string;
          label: string;
          last_match_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          value_hash?: string;
          label?: string;
          last_match_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_watch_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_progress: {
        Row: {
          user_id: string;
          guide_slug: string;
          quiz_score: number | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          guide_slug: string;
          quiz_score?: number | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          guide_slug?: string;
          quiz_score?: number | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          user_id: string;
          badge: string;
          awarded_at: string;
        };
        Insert: {
          user_id: string;
          badge: string;
          awarded_at?: string;
        };
        Update: {
          user_id?: string;
          badge?: string;
          awarded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_log: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          granted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          granted: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          granted?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_usage: {
        Row: {
          key_id: string;
          day: string;
          calls: number;
        };
        Insert: {
          key_id: string;
          day: string;
          calls?: number;
        };
        Update: {
          key_id?: string;
          day?: string;
          calls?: number;
        };
        Relationships: [
          {
            foreignKeyName: "api_usage_key_id_fkey";
            columns: ["key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_views: {
        Row: {
          id: string;
          user_id: string;
          scope: string;
          name: string;
          filters: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scope?: string;
          name: string;
          filters?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scope?: string;
          name?: string;
          filters?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_events: {
        Row: {
          id: string;
          rule_id: string;
          value: number;
          data: Json;
          fired_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          value: number;
          data?: Json;
          fired_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          value?: number;
          data?: Json;
          fired_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_events_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "alert_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      phishing_scans: {
        Row: {
          id: string;
          owner_key: string;
          owner_user_id: string | null;
          owner_org_id: string | null;
          owner_install_id: string | null;
          idempotency_key: string;
          channel: string;
          source: string;
          status: string;
          verdict: string;
          risk_score: number | null;
          severity: string | null;
          confidence: number | null;
          phishing_type: string | null;
          phishing_family: string | null;
          malware_family: string | null;
          campaign_id: string | null;
          threat_actor_id: string | null;
          attribution_status: string;
          input: Json;
          options: Json;
          stages: Json;
          progress: number;
          attempts: number;
          error: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          updated_at: string;
          albania: boolean;
          albania_signals: string[];
          vt_max_malicious: number | null;
        };
        Insert: {
          id?: string;
          owner_key: string;
          owner_user_id?: string | null;
          owner_org_id?: string | null;
          owner_install_id?: string | null;
          idempotency_key: string;
          channel: string;
          source: string;
          status?: string;
          verdict?: string;
          risk_score?: number | null;
          severity?: string | null;
          confidence?: number | null;
          phishing_type?: string | null;
          phishing_family?: string | null;
          malware_family?: string | null;
          campaign_id?: string | null;
          threat_actor_id?: string | null;
          attribution_status?: string;
          input: Json;
          options?: Json;
          stages?: Json;
          progress?: number;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
          albania?: boolean;
          albania_signals?: string[];
          vt_max_malicious?: number | null;
        };
        Update: {
          id?: string;
          owner_key?: string;
          owner_user_id?: string | null;
          owner_org_id?: string | null;
          owner_install_id?: string | null;
          idempotency_key?: string;
          channel?: string;
          source?: string;
          status?: string;
          verdict?: string;
          risk_score?: number | null;
          severity?: string | null;
          confidence?: number | null;
          phishing_type?: string | null;
          phishing_family?: string | null;
          malware_family?: string | null;
          campaign_id?: string | null;
          threat_actor_id?: string | null;
          attribution_status?: string;
          input?: Json;
          options?: Json;
          stages?: Json;
          progress?: number;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
          albania?: boolean;
          albania_signals?: string[];
          vt_max_malicious?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "phishing_scans_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phishing_scans_owner_org_id_fkey";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phishing_scans_owner_install_id_fkey";
            columns: ["owner_install_id"];
            isOneToOne: false;
            referencedRelation: "extension_installs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phishing_scans_actor_fkey";
            columns: ["threat_actor_id"];
            isOneToOne: false;
            referencedRelation: "threat_actors";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_iocs: {
        Row: {
          id: string;
          scan_id: string;
          type: string;
          value: string;
          normalized_value: string;
          location: string;
          created_at: string;
          subtype: string | null;
          detail: Json;
        };
        Insert: {
          id?: string;
          scan_id: string;
          type: string;
          value: string;
          normalized_value: string;
          location: string;
          created_at?: string;
          subtype?: string | null;
          detail?: Json;
        };
        Update: {
          id?: string;
          scan_id?: string;
          type?: string;
          value?: string;
          normalized_value?: string;
          location?: string;
          created_at?: string;
          subtype?: string | null;
          detail?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "scan_iocs_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      ioc_reputation: {
        Row: {
          id: string;
          provider: string;
          ioc_type: string;
          normalized_value: string;
          found: boolean;
          malicious: number | null;
          suspicious: number | null;
          harmless: number | null;
          undetected: number | null;
          reputation: number | null;
          threat_label: string | null;
          categories: string[];
          first_seen: string | null;
          last_analysis_at: string | null;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          ioc_type: string;
          normalized_value: string;
          found: boolean;
          malicious?: number | null;
          suspicious?: number | null;
          harmless?: number | null;
          undetected?: number | null;
          reputation?: number | null;
          threat_label?: string | null;
          categories?: string[];
          first_seen?: string | null;
          last_analysis_at?: string | null;
          fetched_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          provider?: string;
          ioc_type?: string;
          normalized_value?: string;
          found?: boolean;
          malicious?: number | null;
          suspicious?: number | null;
          harmless?: number | null;
          undetected?: number | null;
          reputation?: number | null;
          threat_label?: string | null;
          categories?: string[];
          first_seen?: string | null;
          last_analysis_at?: string | null;
          fetched_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      phishing_classifications: {
        Row: {
          id: string;
          scan_id: string;
          dimension: string;
          value: string;
          confidence: number;
          evidence: Json;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          dimension: string;
          value: string;
          confidence: number;
          evidence?: Json;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          dimension?: string;
          value?: string;
          confidence?: number;
          evidence?: Json;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "phishing_classifications_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      threat_actors: {
        Row: {
          id: string;
          name: string;
          aliases: string[];
          description: string | null;
          refs: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          aliases?: string[];
          description?: string | null;
          refs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          aliases?: string[];
          description?: string | null;
          refs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      actor_evidence: {
        Row: {
          id: string;
          actor_id: string;
          campaign_id: string | null;
          ioc_type: string | null;
          ioc_value: string | null;
          kind: string;
          source: string;
          source_url: string | null;
          verified: boolean;
          observed_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          actor_id: string;
          campaign_id?: string | null;
          ioc_type?: string | null;
          ioc_value?: string | null;
          kind: string;
          source: string;
          source_url?: string | null;
          verified?: boolean;
          observed_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          actor_id?: string;
          campaign_id?: string | null;
          ioc_type?: string | null;
          ioc_value?: string | null;
          kind?: string;
          source?: string;
          source_url?: string | null;
          verified?: boolean;
          observed_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "actor_evidence_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "threat_actors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actor_evidence_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_techniques: {
        Row: {
          scan_id: string;
          technique_id: string;
          name: string;
          tactic: string;
          observation: string;
        };
        Insert: {
          scan_id: string;
          technique_id: string;
          name: string;
          tactic: string;
          observation: string;
        };
        Update: {
          scan_id?: string;
          technique_id?: string;
          name?: string;
          tactic?: string;
          observation?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_techniques_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_reports: {
        Row: {
          scan_id: string;
          channel: string;
          report: Json;
          created_at: string;
        };
        Insert: {
          scan_id: string;
          channel: string;
          report: Json;
          created_at?: string;
        };
        Update: {
          scan_id?: string;
          channel?: string;
          report?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_reports_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: true;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_analysis_logs: {
        Row: {
          id: string;
          scan_id: string;
          provider: string;
          model: string;
          prompt_version: string;
          policy: string;
          status: string;
          latency_ms: number | null;
          tokens: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          provider: string;
          model: string;
          prompt_version: string;
          policy: string;
          status: string;
          latency_ms?: number | null;
          tokens?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          provider?: string;
          model?: string;
          prompt_version?: string;
          policy?: string;
          status?: string;
          latency_ms?: number | null;
          tokens?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_analysis_logs_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_events: {
        Row: {
          id: number;
          scan_id: string;
          stage: string;
          status: string;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          scan_id: string;
          stage: string;
          status: string;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          scan_id?: string;
          stage?: string;
          status?: string;
          message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_events_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      landing_analyses: {
        Row: {
          id: string;
          scan_id: string;
          provider: string;
          url: string;
          url_key: string;
          status: string;
          provider_uuid: string | null;
          visibility: string | null;
          result_url: string | null;
          screenshot_url: string | null;
          final_url: string | null;
          final_domain: string | null;
          page: Json;
          verdict: Json;
          forms: Json;
          exfil: Json;
          requests: Json;
          reputation: Json;
          sanitized: Json;
          error: string | null;
          requested_by: string | null;
          attempts: number;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          scan_id: string;
          provider?: string;
          url: string;
          url_key: string;
          status?: string;
          provider_uuid?: string | null;
          visibility?: string | null;
          result_url?: string | null;
          screenshot_url?: string | null;
          final_url?: string | null;
          final_domain?: string | null;
          page?: Json;
          verdict?: Json;
          forms?: Json;
          exfil?: Json;
          requests?: Json;
          reputation?: Json;
          sanitized?: Json;
          error?: string | null;
          requested_by?: string | null;
          attempts?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          scan_id?: string;
          provider?: string;
          url?: string;
          url_key?: string;
          status?: string;
          provider_uuid?: string | null;
          visibility?: string | null;
          result_url?: string | null;
          screenshot_url?: string | null;
          final_url?: string | null;
          final_domain?: string | null;
          page?: Json;
          verdict?: Json;
          forms?: Json;
          exfil?: Json;
          requests?: Json;
          reputation?: Json;
          sanitized?: Json;
          error?: string | null;
          requested_by?: string | null;
          attempts?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "landing_analyses_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "phishing_scans";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      soc_daily_volume: {
        Row: { day: string | null; flag: string | null; n: number | null };
        Relationships: [];
      };
      public_threat_feed: {
        Row: {
          code: string | null;
          tactic: string | null;
          imitated_name: string | null;
          first_seen: string | null;
          last_seen: string | null;
          message_count: number | null;
          status: Database["public"]["Enums"]["campaign_status"] | null;
          domains: string[] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      platform_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["app_platform_role"] };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_lead: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      org_role: { Args: { p_org: string }; Returns: Database["public"]["Enums"]["org_member_role"] };
      is_org_member: { Args: { p_org: string }; Returns: boolean };
      next_protocol: { Args: Record<PropertyKey, never>; Returns: string };
      can_read_scan: { Args: { p_scan: string }; Returns: boolean };
      api_usage_hit: { Args: { p_key: string }; Returns: undefined };
      similar_messages: { Args: { p_message: string; p_limit?: number }; Returns: { id: string; body_masked: string; similarity: number; campaign_id: string | null; created_at: string }[] };
      similar_campaign_by_body: { Args: { p_body: string; p_min?: number; p_days?: number }; Returns: { campaign_id: string; similarity: number }[] };
      search_messages: { Args: { p_q: string; p_limit?: number }; Returns: { id: string; body_masked: string; similarity: number; campaign_id: string | null; label: Database["public"]["Enums"]["msg_label"] }[] };
      my_institution_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      create_business_org: { Args: { p_name: string }; Returns: string };
      rate_limit_hit: { Args: { p_key: string; p_window_sec: number; p_max: number }; Returns: { allowed: boolean; current_hits: number; reset_at: string }[] };
    };
    Enums: {
      app_platform_role: "user" | "soc_analyst" | "soc_lead" | "platform_admin";
      org_type: "business" | "institution" | "soc";
      org_member_role: "owner" | "admin" | "security" | "comms" | "finance" | "viewer" | "contact";
      msg_channel: "sms" | "email" | "social" | "web" | "qr" | "call" | "other";
      msg_label: "phishing" | "legitimate" | "unknown";
      flag_level: "green" | "yellow" | "orange" | "red" | "darkred" | "grey";
      report_source: "citizen_check" | "citizen_report" | "extension" | "feed" | "business" | "import";
      report_status: "received" | "under_review" | "confirmed" | "not_scam" | "takedown_requested" | "taken_down" | "duplicate";
      campaign_status: "monitoring" | "confirmed" | "takedown_in_progress" | "resolved";
      domain_class: "typosquat" | "homoglyph" | "combosquat" | "legitimate" | "unknown";
      ioc_type: "domain" | "url" | "ip" | "cert" | "phone" | "email" | "file_hash";
      notice_type: "registrar" | "hosting" | "akcesk";
      notice_status: "draft" | "in_review" | "approved" | "sent" | "acknowledged" | "taken_down" | "no_response" | "rejected";
      severity: "low" | "medium" | "high" | "critical";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      app_platform_role: ["user", "soc_analyst", "soc_lead", "platform_admin"],
      org_type: ["business", "institution", "soc"],
      org_member_role: ["owner", "admin", "security", "comms", "finance", "viewer", "contact"],
      msg_channel: ["sms", "email", "social", "web", "qr", "call", "other"],
      msg_label: ["phishing", "legitimate", "unknown"],
      flag_level: ["green", "yellow", "orange", "red", "darkred", "grey"],
      report_source: ["citizen_check", "citizen_report", "extension", "feed", "business", "import"],
      report_status: ["received", "under_review", "confirmed", "not_scam", "takedown_requested", "taken_down", "duplicate"],
      campaign_status: ["monitoring", "confirmed", "takedown_in_progress", "resolved"],
      domain_class: ["typosquat", "homoglyph", "combosquat", "legitimate", "unknown"],
      ioc_type: ["domain", "url", "ip", "cert", "phone", "email", "file_hash"],
      notice_type: ["registrar", "hosting", "akcesk"],
      notice_status: ["draft", "in_review", "approved", "sent", "acknowledged", "taken_down", "no_response", "rejected"],
      severity: ["low", "medium", "high", "critical"],
    },
  },
} as const;
