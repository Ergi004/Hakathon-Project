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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      advisories: {
        Row: {
          approved_by: string | null
          body_en: string
          body_sq: string
          campaign_id: string | null
          created_by: string
          id: string
          published_at: string | null
          severity: Database["public"]["Enums"]["severity"]
          slug: string
          status: string
          title_en: string
          title_sq: string
        }
        Insert: {
          approved_by?: string | null
          body_en: string
          body_sq: string
          campaign_id?: string | null
          created_by: string
          id?: string
          published_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          slug: string
          status?: string
          title_en: string
          title_sq: string
        }
        Update: {
          approved_by?: string | null
          body_en?: string
          body_sq?: string
          campaign_id?: string | null
          created_by?: string
          id?: string
          published_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          slug?: string
          status?: string
          title_en?: string
          title_sq?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisories_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisories_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          active: boolean
          channel: string
          condition: Json
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          channel?: string
          condition: Json
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          channel?: string
          condition?: Json
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          org_id: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          org_id: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          data: Json
          entity: string
          entity_id: string | null
          id: number
          ip_hash: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          data?: Json
          entity: string
          entity_id?: string | null
          id?: never
          ip_hash?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          data?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocklist_entries: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          reason: string | null
          type: Database["public"]["Enums"]["ioc_type"]
          value: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          type: Database["public"]["Enums"]["ioc_type"]
          value: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          type?: Database["public"]["Enums"]["ioc_type"]
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocklist_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocklist_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_alerts: {
        Row: {
          campaign_id: string | null
          created_at: string
          domain_id: string | null
          id: string
          org_id: string
          severity: Database["public"]["Enums"]["severity"]
          status: string
          title: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          domain_id?: string | null
          id?: string
          org_id: string
          severity?: Database["public"]["Enums"]["severity"]
          status?: string
          title: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          domain_id?: string | null
          id?: string
          org_id?: string
          severity?: Database["public"]["Enums"]["severity"]
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_alerts_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          id: string
          kind: string
          org_id: string
          value: string
          verified_at: string | null
        }
        Insert: {
          id?: string
          kind: string
          org_id: string
          value: string
          verified_at?: string | null
        }
        Update: {
          id?: string
          kind?: string
          org_id?: string
          value?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_domains: {
        Row: {
          campaign_id: string
          domain_id: string
        }
        Insert: {
          campaign_id: string
          domain_id: string
        }
        Update: {
          campaign_id?: string
          domain_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_domains_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_notes: {
        Row: {
          author_id: string
          body: string
          campaign_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          campaign_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          code: string
          created_at: string
          first_seen: string | null
          id: string
          imitated_name: string | null
          institution_id: string | null
          is_public: boolean
          last_seen: string | null
          message_count: number
          owner_id: string | null
          severity: Database["public"]["Enums"]["severity"]
          source: string
          status: Database["public"]["Enums"]["campaign_status"]
          summary: string | null
          tactic: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          first_seen?: string | null
          id?: string
          imitated_name?: string | null
          institution_id?: string | null
          is_public?: boolean
          last_seen?: string | null
          message_count?: number
          owner_id?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          source?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          summary?: string | null
          tactic: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          first_seen?: string | null
          id?: string
          imitated_name?: string | null
          institution_id?: string | null
          is_public?: boolean
          last_seen?: string | null
          message_count?: number
          owner_id?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          source?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          summary?: string | null
          tactic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assignee_id: string | null
          campaign_id: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["severity"]
          status: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["severity"]
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["severity"]
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          campaign_id: string | null
          cert_id: string
          domain_id: string | null
          imitated_domain: string | null
          issuer: string | null
          label: Database["public"]["Enums"]["domain_class"] | null
          not_after: string | null
          not_before: string | null
          san: string[]
        }
        Insert: {
          campaign_id?: string | null
          cert_id: string
          domain_id?: string | null
          imitated_domain?: string | null
          issuer?: string | null
          label?: Database["public"]["Enums"]["domain_class"] | null
          not_after?: string | null
          not_before?: string | null
          san?: string[]
        }
        Update: {
          campaign_id?: string | null
          cert_id?: string
          domain_id?: string | null
          imitated_domain?: string | null
          issuer?: string | null
          label?: Database["public"]["Enums"]["domain_class"] | null
          not_after?: string | null
          not_before?: string | null
          san?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "certificates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      checks: {
        Row: {
          campaign_id: string | null
          created_at: string
          flag: Database["public"]["Enums"]["flag_level"]
          id: string
          input_hash: string
          input_kind: string
          model_version: string | null
          reasons: Json
          score: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          flag: Database["public"]["Enums"]["flag_level"]
          id?: string
          input_hash: string
          input_kind: string
          model_version?: string | null
          reasons?: Json
          score: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          flag?: Database["public"]["Enums"]["flag_level"]
          id?: string
          input_hash?: string
          input_kind?: string
          model_version?: string | null
          reasons?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "checks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          age_days: number | null
          class: Database["public"]["Enums"]["domain_class"]
          domain: string
          first_seen_at: string
          hosting_country: string | null
          id: string
          imitates_domain: string | null
          imitates_institution_id: string | null
          in_ct_log: boolean
          nameserver: string | null
          privacy: boolean | null
          registered_at: string | null
          registrar: string | null
          risk_score: number | null
          rule: string | null
          status: string
        }
        Insert: {
          age_days?: number | null
          class?: Database["public"]["Enums"]["domain_class"]
          domain: string
          first_seen_at?: string
          hosting_country?: string | null
          id?: string
          imitates_domain?: string | null
          imitates_institution_id?: string | null
          in_ct_log?: boolean
          nameserver?: string | null
          privacy?: boolean | null
          registered_at?: string | null
          registrar?: string | null
          risk_score?: number | null
          rule?: string | null
          status?: string
        }
        Update: {
          age_days?: number | null
          class?: Database["public"]["Enums"]["domain_class"]
          domain?: string
          first_seen_at?: string
          hosting_country?: string | null
          id?: string
          imitates_domain?: string | null
          imitates_institution_id?: string | null
          in_ct_log?: boolean
          nameserver?: string | null
          privacy?: boolean | null
          registered_at?: string | null
          registrar?: string | null
          risk_score?: number | null
          rule?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_imitates_institution_id_fkey"
            columns: ["imitates_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_installs: {
        Row: {
          auto_submit: boolean
          consent_at: string | null
          created_at: string
          id: string
          install_hash: string
          last_seen: string
          user_id: string | null
          version: string | null
        }
        Insert: {
          auto_submit?: boolean
          consent_at?: string | null
          created_at?: string
          id?: string
          install_hash: string
          last_seen?: string
          user_id?: string | null
          version?: string | null
        }
        Update: {
          auto_submit?: boolean
          consent_at?: string | null
          created_at?: string
          id?: string
          install_hash?: string
          last_seen?: string
          user_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extension_installs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_reports: {
        Row: {
          created_at: string
          id: string
          install_id: string
          report_id: string
          signals: Json
        }
        Insert: {
          created_at?: string
          id?: string
          install_id: string
          report_id: string
          signals: Json
        }
        Update: {
          created_at?: string
          id?: string
          install_id?: string
          report_id?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "extension_reports_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "extension_installs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_labels: {
        Row: {
          actual: Database["public"]["Enums"]["msg_label"]
          analyst_id: string
          created_at: string
          id: string
          message_id: string | null
          predicted: Database["public"]["Enums"]["msg_label"] | null
          report_id: string | null
        }
        Insert: {
          actual: Database["public"]["Enums"]["msg_label"]
          analyst_id: string
          created_at?: string
          id?: string
          message_id?: string | null
          predicted?: Database["public"]["Enums"]["msg_label"] | null
          report_id?: string | null
        }
        Update: {
          actual?: Database["public"]["Enums"]["msg_label"]
          analyst_id?: string
          created_at?: string
          id?: string
          message_id?: string | null
          predicted?: Database["public"]["Enums"]["msg_label"] | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_labels_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_labels_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_labels_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          sector: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          sector?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          sector?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      iocs: {
        Row: {
          campaign_id: string | null
          first_seen: string
          id: string
          last_seen: string
          source: string
          type: Database["public"]["Enums"]["ioc_type"]
          value: string
        }
        Insert: {
          campaign_id?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          source?: string
          type: Database["public"]["Enums"]["ioc_type"]
          value: string
        }
        Update: {
          campaign_id?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          source?: string
          type?: Database["public"]["Enums"]["ioc_type"]
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "iocs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      known_hashes: {
        Row: {
          campaign_id: string | null
          flag: Database["public"]["Enums"]["flag_level"]
          hash: string
          kind: string
          last_seen: string
          seen_count: number
        }
        Insert: {
          campaign_id?: string | null
          flag: Database["public"]["Enums"]["flag_level"]
          hash: string
          kind: string
          last_seen?: string
          seen_count?: number
        }
        Update: {
          campaign_id?: string | null
          flag?: Database["public"]["Enums"]["flag_level"]
          hash?: string
          kind?: string
          last_seen?: string
          seen_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "known_hashes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body_hash: string
          body_masked: string
          campaign_id: string | null
          channel: Database["public"]["Enums"]["msg_channel"]
          created_at: string
          external_id: string | null
          flag: Database["public"]["Enums"]["flag_level"] | null
          id: string
          institution_id: string | null
          label: Database["public"]["Enums"]["msg_label"]
          language: string
          received_at: string | null
          score: number | null
          sender_masked: string | null
          source: string
          subject: string | null
          tactic: string | null
          template_id: string | null
          urls: string[]
        }
        Insert: {
          body_hash: string
          body_masked: string
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          external_id?: string | null
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: string
          institution_id?: string | null
          label?: Database["public"]["Enums"]["msg_label"]
          language: string
          received_at?: string | null
          score?: number | null
          sender_masked?: string | null
          source?: string
          subject?: string | null
          tactic?: string | null
          template_id?: string | null
          urls?: string[]
        }
        Update: {
          body_hash?: string
          body_masked?: string
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          external_id?: string | null
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: string
          institution_id?: string | null
          label?: Database["public"]["Enums"]["msg_label"]
          language?: string
          received_at?: string | null
          score?: number | null
          sender_masked?: string | null
          source?: string
          subject?: string | null
          tactic?: string | null
          template_id?: string | null
          urls?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          active: boolean
          artifact_path: string | null
          created_at: string
          id: string
          metrics: Json
          name: string
          version: string
        }
        Insert: {
          active?: boolean
          artifact_path?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          name: string
          version: string
        }
        Update: {
          active?: boolean
          artifact_path?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          name?: string
          version?: string
        }
        Relationships: []
      }
      notice_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          notice_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          notice_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          notice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_events_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "takedown_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      official_channels: {
        Row: {
          id: string
          institution_id: string
          kind: string
          value: string
        }
        Insert: {
          id?: string
          institution_id: string
          kind: string
          value: string
        }
        Update: {
          id?: string
          institution_id?: string
          kind?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_channels_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      official_domains: {
        Row: {
          domain: string
          id: string
          institution_id: string
          verified: boolean
        }
        Insert: {
          domain: string
          id?: string
          institution_id: string
          verified?: boolean
        }
        Update: {
          domain?: string
          id?: string
          institution_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "official_domains_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          type?: Database["public"]["Enums"]["org_type"]
        }
        Relationships: []
      }
      outbox: {
        Row: {
          body: string
          entity: string | null
          entity_id: string | null
          id: string
          kind: string
          sent_at: string
          simulated: boolean
          subject: string
          to_address: string
        }
        Insert: {
          body: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind?: string
          sent_at?: string
          simulated?: boolean
          subject: string
          to_address: string
        }
        Update: {
          body?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind?: string
          sent_at?: string
          simulated?: boolean
          subject?: string
          to_address?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: string
          platform_role: Database["public"]["Enums"]["app_platform_role"]
          safety_score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          platform_role?: Database["public"]["Enums"]["app_platform_role"]
          safety_score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          platform_role?: Database["public"]["Enums"]["app_platform_role"]
          safety_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          abuse_email: string
          id: string
          kind: Database["public"]["Enums"]["notice_type"]
          match_pattern: string | null
          name: string
          sla_hours: number
        }
        Insert: {
          abuse_email: string
          id?: string
          kind: Database["public"]["Enums"]["notice_type"]
          match_pattern?: string | null
          name: string
          sla_hours?: number
        }
        Update: {
          abuse_email?: string
          id?: string
          kind?: Database["public"]["Enums"]["notice_type"]
          match_pattern?: string | null
          name?: string
          sla_hours?: number
        }
        Relationships: []
      }
      report_events: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          kind: string
          report_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind: string
          report_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          channel: Database["public"]["Enums"]["msg_channel"] | null
          consent_signal_report: boolean
          created_at: string
          flag: Database["public"]["Enums"]["flag_level"] | null
          id: string
          message_id: string | null
          protocol: string
          reasons: Json
          reporter_contact: string | null
          reporter_id: string | null
          reporter_org_id: string | null
          resolution_note: string | null
          score: number | null
          source: Database["public"]["Enums"]["report_source"]
          status: Database["public"]["Enums"]["report_status"]
          tracking_token_hash: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"] | null
          consent_signal_report?: boolean
          created_at?: string
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: string
          message_id?: string | null
          protocol?: string
          reasons?: Json
          reporter_contact?: string | null
          reporter_id?: string | null
          reporter_org_id?: string | null
          resolution_note?: string | null
          score?: number | null
          source: Database["public"]["Enums"]["report_source"]
          status?: Database["public"]["Enums"]["report_status"]
          tracking_token_hash?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"] | null
          consent_signal_report?: boolean
          created_at?: string
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: string
          message_id?: string | null
          protocol?: string
          reasons?: Json
          reporter_contact?: string | null
          reporter_id?: string | null
          reporter_org_id?: string | null
          resolution_note?: string | null
          score?: number | null
          source?: Database["public"]["Enums"]["report_source"]
          status?: Database["public"]["Enums"]["report_status"]
          tracking_token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_org_id_fkey"
            columns: ["reporter_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          clicked: number
          created_at: string
          created_by: string
          id: string
          name: string
          opened: number
          org_id: string
          reported: number
          sent: number
          status: string
          template_key: string
        }
        Insert: {
          clicked?: number
          created_at?: string
          created_by: string
          id?: string
          name: string
          opened?: number
          org_id: string
          reported?: number
          sent?: number
          status?: string
          template_key: string
        }
        Update: {
          clicked?: number
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          opened?: number
          org_id?: string
          reported?: number
          sent?: number
          status?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takedown_notices: {
        Row: {
          approved_by: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string
          domain_id: string | null
          due_at: string | null
          evidence_path: string | null
          id: string
          kind: Database["public"]["Enums"]["notice_type"]
          protocol: string
          recipient_id: string | null
          resolved_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notice_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          body: string
          campaign_id: string
          created_at?: string
          created_by: string
          domain_id?: string | null
          due_at?: string | null
          evidence_path?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notice_type"]
          protocol?: string
          recipient_id?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notice_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          body?: string
          campaign_id?: string
          created_at?: string
          created_by?: string
          domain_id?: string | null
          due_at?: string | null
          evidence_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notice_type"]
          protocol?: string
          recipient_id?: string | null
          resolved_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notice_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "takedown_notices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takedown_notices_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takedown_notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takedown_notices_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takedown_notices_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          active: boolean
          body: string
          id: string
          kind: Database["public"]["Enums"]["notice_type"]
          locale: string
          subject: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          id?: string
          kind: Database["public"]["Enums"]["notice_type"]
          locale: string
          subject: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          id?: string
          kind?: Database["public"]["Enums"]["notice_type"]
          locale?: string
          subject?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      public_threat_feed: {
        Row: {
          code: string | null
          domains: string[] | null
          first_seen: string | null
          imitated_name: string | null
          last_seen: string | null
          message_count: number | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          tactic: string | null
        }
        Insert: {
          code?: string | null
          domains?: never
          first_seen?: string | null
          imitated_name?: string | null
          last_seen?: string | null
          message_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          tactic?: string | null
        }
        Update: {
          code?: string | null
          domains?: never
          first_seen?: string | null
          imitated_name?: string | null
          last_seen?: string | null
          message_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          tactic?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_lead: { Args: never; Returns: boolean }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      next_protocol: { Args: never; Returns: string }
      org_role: {
        Args: { p_org: string }
        Returns: Database["public"]["Enums"]["org_member_role"]
      }
      platform_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_platform_role"]
      }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_sec: number }
        Returns: {
          allowed: boolean
          current_hits: number
          reset_at: string
        }[]
      }
    }
    Enums: {
      app_platform_role: "user" | "soc_analyst" | "soc_lead" | "platform_admin"
      campaign_status:
        | "monitoring"
        | "confirmed"
        | "takedown_in_progress"
        | "resolved"
      domain_class:
        | "typosquat"
        | "homoglyph"
        | "combosquat"
        | "legitimate"
        | "unknown"
      flag_level: "green" | "yellow" | "orange" | "red" | "darkred" | "grey"
      ioc_type:
        | "domain"
        | "url"
        | "ip"
        | "cert"
        | "phone"
        | "email"
        | "file_hash"
      msg_channel: "sms" | "email" | "social" | "web" | "qr" | "call" | "other"
      msg_label: "phishing" | "legitimate" | "unknown"
      notice_status:
        | "draft"
        | "in_review"
        | "approved"
        | "sent"
        | "acknowledged"
        | "taken_down"
        | "no_response"
        | "rejected"
      notice_type: "registrar" | "hosting" | "akcesk"
      org_member_role:
        | "owner"
        | "admin"
        | "security"
        | "comms"
        | "finance"
        | "viewer"
        | "contact"
      org_type: "business" | "institution" | "soc"
      report_source:
        | "citizen_check"
        | "citizen_report"
        | "extension"
        | "feed"
        | "business"
        | "import"
      report_status:
        | "received"
        | "under_review"
        | "confirmed"
        | "not_scam"
        | "takedown_requested"
        | "taken_down"
        | "duplicate"
      severity: "low" | "medium" | "high" | "critical"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_platform_role: ["user", "soc_analyst", "soc_lead", "platform_admin"],
      campaign_status: [
        "monitoring",
        "confirmed",
        "takedown_in_progress",
        "resolved",
      ],
      domain_class: [
        "typosquat",
        "homoglyph",
        "combosquat",
        "legitimate",
        "unknown",
      ],
      flag_level: ["green", "yellow", "orange", "red", "darkred", "grey"],
      ioc_type: ["domain", "url", "ip", "cert", "phone", "email", "file_hash"],
      msg_channel: ["sms", "email", "social", "web", "qr", "call", "other"],
      msg_label: ["phishing", "legitimate", "unknown"],
      notice_status: [
        "draft",
        "in_review",
        "approved",
        "sent",
        "acknowledged",
        "taken_down",
        "no_response",
        "rejected",
      ],
      notice_type: ["registrar", "hosting", "akcesk"],
      org_member_role: [
        "owner",
        "admin",
        "security",
        "comms",
        "finance",
        "viewer",
        "contact",
      ],
      org_type: ["business", "institution", "soc"],
      report_source: [
        "citizen_check",
        "citizen_report",
        "extension",
        "feed",
        "business",
        "import",
      ],
      report_status: [
        "received",
        "under_review",
        "confirmed",
        "not_scam",
        "takedown_requested",
        "taken_down",
        "duplicate",
      ],
      severity: ["low", "medium", "high", "critical"],
    },
  },
} as const
