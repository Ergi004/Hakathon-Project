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
      actor_evidence: {
        Row: {
          actor_id: string
          campaign_id: string | null
          created_by: string | null
          id: string
          ioc_type: string | null
          ioc_value: string | null
          kind: string
          observed_at: string
          source: string
          source_url: string | null
          verified: boolean
        }
        Insert: {
          actor_id: string
          campaign_id?: string | null
          created_by?: string | null
          id?: string
          ioc_type?: string | null
          ioc_value?: string | null
          kind: string
          observed_at?: string
          source: string
          source_url?: string | null
          verified?: boolean
        }
        Update: {
          actor_id?: string
          campaign_id?: string | null
          created_by?: string | null
          id?: string
          ioc_type?: string | null
          ioc_value?: string | null
          kind?: string
          observed_at?: string
          source?: string
          source_url?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "actor_evidence_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "threat_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_evidence_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_analysis_logs: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          model: string
          policy: string
          prompt_version: string
          provider: string
          scan_id: string
          status: string
          tokens: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          model: string
          policy: string
          prompt_version: string
          provider: string
          scan_id: string
          status: string
          tokens?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string
          policy?: string
          prompt_version?: string
          provider?: string
          scan_id?: string
          status?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_logs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_events: {
        Row: {
          data: Json
          fired_at: string
          id: string
          rule_id: string
          value: number
        }
        Insert: {
          data?: Json
          fired_at?: string
          id?: string
          rule_id: string
          value: number
        }
        Update: {
          data?: Json
          fired_at?: string
          id?: string
          rule_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
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
      api_usage: {
        Row: {
          calls: number
          day: string
          key_id: string
        }
        Insert: {
          calls?: number
          day: string
          key_id: string
        }
        Update: {
          calls?: number
          day?: string
          key_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
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
          target_region_id: string | null
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
          target_region_id?: string | null
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
          target_region_id?: string | null
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
          {
            foreignKeyName: "campaigns_target_region_id_fkey"
            columns: ["target_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
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
          confidence: number | null
          created_at: string
          features: Json | null
          flag: Database["public"]["Enums"]["flag_level"]
          id: string
          impersonated_brand: string | null
          input_hash: string
          input_kind: string
          model_version: string | null
          reasons: Json
          scam_type: string | null
          score: number
        }
        Insert: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string
          features?: Json | null
          flag: Database["public"]["Enums"]["flag_level"]
          id?: string
          impersonated_brand?: string | null
          input_hash: string
          input_kind: string
          model_version?: string | null
          reasons?: Json
          scam_type?: string | null
          score: number
        }
        Update: {
          campaign_id?: string | null
          confidence?: number | null
          created_at?: string
          features?: Json | null
          flag?: Database["public"]["Enums"]["flag_level"]
          id?: string
          impersonated_brand?: string | null
          input_hash?: string
          input_kind?: string
          model_version?: string | null
          reasons?: Json
          scam_type?: string | null
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
      consent_log: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          token_hash: string | null
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
          token_hash?: string | null
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
          token_hash?: string | null
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
      geo_alert_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          institution_id: string | null
          min_reports: number
          min_spike_ratio: number
          min_zscore: number
          name: string
          region_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string | null
          min_reports?: number
          min_spike_ratio?: number
          min_zscore?: number
          name: string
          region_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string | null
          min_reports?: number
          min_spike_ratio?: number
          min_zscore?: number
          name?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_alert_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_alert_rules_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_alert_rules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_hotspots: {
        Row: {
          computed_at: string
          expected: number
          id: string
          mode: string
          observed: number
          region_id: string
          severity: string
          smoothed_rate: number | null
          spike_ratio: number | null
          top_campaign_id: string | null
          top_institution_id: string | null
          window_days: number
          zone_code: string | null
          zscore: number
        }
        Insert: {
          computed_at?: string
          expected: number
          id?: string
          mode: string
          observed: number
          region_id: string
          severity: string
          smoothed_rate?: number | null
          spike_ratio?: number | null
          top_campaign_id?: string | null
          top_institution_id?: string | null
          window_days: number
          zone_code?: string | null
          zscore: number
        }
        Update: {
          computed_at?: string
          expected?: number
          id?: string
          mode?: string
          observed?: number
          region_id?: string
          severity?: string
          smoothed_rate?: number | null
          spike_ratio?: number | null
          top_campaign_id?: string | null
          top_institution_id?: string | null
          window_days?: number
          zone_code?: string | null
          zscore?: number
        }
        Relationships: [
          {
            foreignKeyName: "geo_hotspots_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_hotspots_top_campaign_id_fkey"
            columns: ["top_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_hotspots_top_institution_id_fkey"
            columns: ["top_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
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
          region_id: string | null
          sector: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          region_id?: string | null
          sector?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          region_id?: string | null
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
          {
            foreignKeyName: "institutions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_cache: {
        Row: {
          expires_at: string
          key: string
          payload: Json
          provider: Database["public"]["Enums"]["intel_provider"]
        }
        Insert: {
          expires_at: string
          key: string
          payload: Json
          provider: Database["public"]["Enums"]["intel_provider"]
        }
        Update: {
          expires_at?: string
          key?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["intel_provider"]
        }
        Relationships: []
      }
      intel_subdomains: {
        Row: {
          brand_token: boolean
          first_cert_at: string | null
          id: string
          registrable_domain: string
          resolves: boolean | null
          scan_id: string
          source: string
          subdomain: string
          verdict: Database["public"]["Enums"]["intel_verdict"]
        }
        Insert: {
          brand_token?: boolean
          first_cert_at?: string | null
          id?: string
          registrable_domain: string
          resolves?: boolean | null
          scan_id: string
          source: string
          subdomain: string
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Update: {
          brand_token?: boolean
          first_cert_at?: string | null
          id?: string
          registrable_domain?: string
          resolves?: boolean | null
          scan_id?: string
          source?: string
          subdomain?: string
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "intel_subdomains_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      ioc_reputation: {
        Row: {
          categories: string[]
          expires_at: string
          fetched_at: string
          first_seen: string | null
          found: boolean
          harmless: number | null
          id: string
          ioc_type: string
          last_analysis_at: string | null
          malicious: number | null
          normalized_value: string
          provider: string
          reputation: number | null
          suspicious: number | null
          threat_label: string | null
          undetected: number | null
        }
        Insert: {
          categories?: string[]
          expires_at: string
          fetched_at?: string
          first_seen?: string | null
          found: boolean
          harmless?: number | null
          id?: string
          ioc_type: string
          last_analysis_at?: string | null
          malicious?: number | null
          normalized_value: string
          provider: string
          reputation?: number | null
          suspicious?: number | null
          threat_label?: string | null
          undetected?: number | null
        }
        Update: {
          categories?: string[]
          expires_at?: string
          fetched_at?: string
          first_seen?: string | null
          found?: boolean
          harmless?: number | null
          id?: string
          ioc_type?: string
          last_analysis_at?: string | null
          malicious?: number | null
          normalized_value?: string
          provider?: string
          reputation?: number | null
          suspicious?: number | null
          threat_label?: string | null
          undetected?: number | null
        }
        Relationships: []
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
      landing_analyses: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: string | null
          exfil: Json
          final_domain: string | null
          final_url: string | null
          forms: Json
          id: string
          page: Json
          provider: string
          provider_uuid: string | null
          reputation: Json
          requested_by: string | null
          requests: Json
          result_url: string | null
          sanitized: Json
          scan_id: string
          screenshot_url: string | null
          status: string
          updated_at: string
          url: string
          url_key: string
          verdict: Json
          visibility: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          exfil?: Json
          final_domain?: string | null
          final_url?: string | null
          forms?: Json
          id?: string
          page?: Json
          provider?: string
          provider_uuid?: string | null
          reputation?: Json
          requested_by?: string | null
          requests?: Json
          result_url?: string | null
          sanitized?: Json
          scan_id: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          url: string
          url_key: string
          verdict?: Json
          visibility?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          exfil?: Json
          final_domain?: string | null
          final_url?: string | null
          forms?: Json
          id?: string
          page?: Json
          provider?: string
          provider_uuid?: string | null
          reputation?: Json
          requested_by?: string | null
          requests?: Json
          result_url?: string | null
          sanitized?: Json
          scan_id?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          url?: string
          url_key?: string
          verdict?: Json
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_analyses_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
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
          notification_emails: string[]
          plan: string
          retention_days: number
          slug: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          name: string
          notification_emails?: string[]
          plan?: string
          retention_days?: number
          slug: string
          type: Database["public"]["Enums"]["org_type"]
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          notification_emails?: string[]
          plan?: string
          retention_days?: number
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
      phishing_classifications: {
        Row: {
          confidence: number
          created_at: string
          dimension: string
          evidence: Json
          id: string
          scan_id: string
          source: string
          value: string
        }
        Insert: {
          confidence: number
          created_at?: string
          dimension: string
          evidence?: Json
          id?: string
          scan_id: string
          source?: string
          value: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dimension?: string
          evidence?: Json
          id?: string
          scan_id?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "phishing_classifications_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      phishing_scans: {
        Row: {
          albania: boolean
          albania_signals: string[]
          attempts: number
          attribution_status: string
          campaign_id: string | null
          channel: string
          completed_at: string | null
          confidence: number | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          input: Json
          malware_family: string | null
          options: Json
          owner_install_id: string | null
          owner_key: string
          owner_org_id: string | null
          owner_user_id: string | null
          phishing_family: string | null
          phishing_type: string | null
          progress: number
          risk_score: number | null
          severity: string | null
          source: string
          stages: Json
          started_at: string | null
          status: string
          threat_actor_id: string | null
          updated_at: string
          verdict: string
          vt_max_malicious: number | null
        }
        Insert: {
          albania?: boolean
          albania_signals?: string[]
          attempts?: number
          attribution_status?: string
          campaign_id?: string | null
          channel: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          input: Json
          malware_family?: string | null
          options?: Json
          owner_install_id?: string | null
          owner_key: string
          owner_org_id?: string | null
          owner_user_id?: string | null
          phishing_family?: string | null
          phishing_type?: string | null
          progress?: number
          risk_score?: number | null
          severity?: string | null
          source: string
          stages?: Json
          started_at?: string | null
          status?: string
          threat_actor_id?: string | null
          updated_at?: string
          verdict?: string
          vt_max_malicious?: number | null
        }
        Update: {
          albania?: boolean
          albania_signals?: string[]
          attempts?: number
          attribution_status?: string
          campaign_id?: string | null
          channel?: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          input?: Json
          malware_family?: string | null
          options?: Json
          owner_install_id?: string | null
          owner_key?: string
          owner_org_id?: string | null
          owner_user_id?: string | null
          phishing_family?: string | null
          phishing_type?: string | null
          progress?: number
          risk_score?: number | null
          severity?: string | null
          source?: string
          stages?: Json
          started_at?: string | null
          status?: string
          threat_actor_id?: string | null
          updated_at?: string
          verdict?: string
          vt_max_malicious?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phishing_scans_actor_fkey"
            columns: ["threat_actor_id"]
            isOneToOne: false
            referencedRelation: "threat_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phishing_scans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phishing_scans_owner_install_id_fkey"
            columns: ["owner_install_id"]
            isOneToOne: false
            referencedRelation: "extension_installs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phishing_scans_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          locale: string
          notify_email: boolean
          notify_in_app: boolean
          platform_role: Database["public"]["Enums"]["app_platform_role"]
          safety_score: number
          save_history: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          notify_email?: boolean
          notify_in_app?: boolean
          platform_role?: Database["public"]["Enums"]["app_platform_role"]
          safety_score?: number
          save_history?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          notify_email?: boolean
          notify_in_app?: boolean
          platform_role?: Database["public"]["Enums"]["app_platform_role"]
          safety_score?: number
          save_history?: boolean
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
      region_daily_stats: {
        Row: {
          campaign_id: string | null
          channel: Database["public"]["Enums"]["msg_channel"] | null
          confirmed: boolean
          day: string
          flag: Database["public"]["Enums"]["flag_level"] | null
          id: number
          institution_id: string | null
          mode: string
          region_id: string | null
          report_count: number
          source: Database["public"]["Enums"]["report_source"] | null
          tactic: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"] | null
          confirmed?: boolean
          day: string
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: never
          institution_id?: string | null
          mode: string
          region_id?: string | null
          report_count: number
          source?: Database["public"]["Enums"]["report_source"] | null
          tactic?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"] | null
          confirmed?: boolean
          day?: string
          flag?: Database["public"]["Enums"]["flag_level"] | null
          id?: never
          institution_id?: string | null
          mode?: string
          region_id?: string | null
          report_count?: number
          source?: Database["public"]["Enums"]["report_source"] | null
          tactic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "region_daily_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_daily_stats_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_daily_stats_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      region_neighbors: {
        Row: {
          neighbor_id: string
          region_id: string
        }
        Insert: {
          neighbor_id: string
          region_id: string
        }
        Update: {
          neighbor_id?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_neighbors_neighbor_id_fkey"
            columns: ["neighbor_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_neighbors_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      region_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          region_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          region_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_notes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          centroid_lat: number | null
          centroid_lng: number | null
          code: string
          hex_q: number | null
          hex_r: number | null
          id: string
          level: Database["public"]["Enums"]["region_level"]
          name_en: string | null
          name_sq: string
          parent_id: string | null
          population: number | null
          population_year: number | null
        }
        Insert: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          code: string
          hex_q?: number | null
          hex_r?: number | null
          id?: string
          level: Database["public"]["Enums"]["region_level"]
          name_en?: string | null
          name_sq: string
          parent_id?: string | null
          population?: number | null
          population_year?: number | null
        }
        Update: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          code?: string
          hex_q?: number | null
          hex_r?: number | null
          id?: string
          level?: Database["public"]["Enums"]["region_level"]
          name_en?: string | null
          name_sq?: string
          parent_id?: string | null
          population?: number | null
          population_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
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
          region_id: string | null
          region_source: Database["public"]["Enums"]["region_source"] | null
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
          region_id?: string | null
          region_source?: Database["public"]["Enums"]["region_source"] | null
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
          region_id?: string | null
          region_source?: Database["public"]["Enums"]["region_source"] | null
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
            foreignKeyName: "reports_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
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
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_events: {
        Row: {
          created_at: string
          id: number
          message: string | null
          scan_id: string
          stage: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: never
          message?: string | null
          scan_id: string
          stage: string
          status: string
        }
        Update: {
          created_at?: string
          id?: never
          message?: string | null
          scan_id?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_iocs: {
        Row: {
          created_at: string
          detail: Json
          id: string
          location: string
          normalized_value: string
          scan_id: string
          subtype: string | null
          type: string
          value: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          location: string
          normalized_value: string
          scan_id: string
          subtype?: string | null
          type: string
          value: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          location?: string
          normalized_value?: string
          scan_id?: string
          subtype?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_iocs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_reports: {
        Row: {
          channel: string
          created_at: string
          report: Json
          scan_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          report: Json
          scan_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          report?: Json
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_reports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_results: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          malicious_count: number | null
          provider: Database["public"]["Enums"]["intel_provider"]
          report_url: string | null
          scan_id: string
          started_at: string
          status: Database["public"]["Enums"]["intel_status"]
          summary: Json
          total_count: number | null
          verdict: Database["public"]["Enums"]["intel_verdict"]
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          malicious_count?: number | null
          provider: Database["public"]["Enums"]["intel_provider"]
          report_url?: string | null
          scan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["intel_status"]
          summary?: Json
          total_count?: number | null
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          malicious_count?: number | null
          provider?: Database["public"]["Enums"]["intel_provider"]
          report_url?: string | null
          scan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["intel_status"]
          summary?: Json
          total_count?: number | null
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_techniques: {
        Row: {
          name: string
          observation: string
          scan_id: string
          tactic: string
          technique_id: string
        }
        Insert: {
          name: string
          observation: string
          scan_id: string
          tactic: string
          technique_id: string
        }
        Update: {
          name?: string
          observation?: string
          scan_id?: string
          tactic?: string
          technique_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_techniques_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "phishing_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          base_score: number | null
          check_id: string | null
          created_at: string
          domain_age_days: number | null
          final_score: number | null
          finished_at: string | null
          host: string
          id: string
          mock: boolean
          parent_scan_id: string | null
          registered_at: string | null
          registrable_domain: string
          report_id: string | null
          requested_by: string | null
          score_delta: number
          status: string
          tier: string
          token_hash: string
          url_sanitized: string
          verdict: Database["public"]["Enums"]["intel_verdict"]
        }
        Insert: {
          base_score?: number | null
          check_id?: string | null
          created_at?: string
          domain_age_days?: number | null
          final_score?: number | null
          finished_at?: string | null
          host: string
          id?: string
          mock?: boolean
          parent_scan_id?: string | null
          registered_at?: string | null
          registrable_domain: string
          report_id?: string | null
          requested_by?: string | null
          score_delta?: number
          status?: string
          tier?: string
          token_hash: string
          url_sanitized: string
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Update: {
          base_score?: number | null
          check_id?: string | null
          created_at?: string
          domain_age_days?: number | null
          final_score?: number | null
          finished_at?: string | null
          host?: string
          id?: string
          mock?: boolean
          parent_scan_id?: string | null
          registered_at?: string | null
          registrable_domain?: string
          report_id?: string | null
          requested_by?: string | null
          score_delta?: number
          status?: string
          tier?: string
          token_hash?: string
          url_sanitized?: string
          verdict?: Database["public"]["Enums"]["intel_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "scans_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_parent_scan_id_fkey"
            columns: ["parent_scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      threat_actors: {
        Row: {
          aliases: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          refs: Json
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          refs?: Json
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          refs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_check_links: {
        Row: {
          check_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          check_id: string
          created_at?: string
          kind: string
          user_id: string
        }
        Update: {
          check_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_check_links_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_check_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          institution_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          institution_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          institution_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed_at: string | null
          guide_slug: string
          quiz_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          guide_slug: string
          quiz_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          guide_slug?: string
          quiz_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_watch_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          last_match_at: string | null
          user_id: string
          value_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          last_match_at?: string | null
          user_id: string
          value_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          last_match_at?: string | null
          user_id?: string
          value_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_watch_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      advisory_status_counts: {
        Row: {
          n: number | null
          status: string | null
        }
        Relationships: []
      }
      campaign_report_counts: {
        Row: {
          campaign_id: string | null
          channel: Database["public"]["Enums"]["msg_channel"] | null
          flag: string | null
          n: number | null
          status: Database["public"]["Enums"]["report_status"] | null
        }
        Relationships: []
      }
      campaign_status_counts: {
        Row: {
          n: number | null
          status: Database["public"]["Enums"]["campaign_status"] | null
        }
        Relationships: []
      }
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
      public_threat_feed_counts: {
        Row: {
          n: number | null
          status: Database["public"]["Enums"]["campaign_status"] | null
        }
        Relationships: []
      }
      report_status_counts_by_reporter: {
        Row: {
          n: number | null
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"] | null
        }
        Relationships: []
      }
      soc_daily_volume: {
        Row: {
          day: string | null
          flag: string | null
          n: number | null
        }
        Relationships: []
      }
      takedown_status_counts: {
        Row: {
          n: number | null
          overdue: number | null
          status: Database["public"]["Enums"]["notice_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      api_usage_hit: { Args: { p_key: string }; Returns: undefined }
      can_read_scan: { Args: { p_scan: string }; Returns: boolean }
      create_business_org: { Args: { p_name: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_lead: { Args: never; Returns: boolean }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_institution_ids: { Args: never; Returns: string[] }
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
      rebuild_region_stats: { Args: never; Returns: number }
      region_stats_apply: {
        Args: {
          p: Database["public"]["Tables"]["reports"]["Row"]
          p_delta: number
        }
        Returns: undefined
      }
      region_stats_bump: {
        Args: {
          p_campaign: string
          p_channel: Database["public"]["Enums"]["msg_channel"]
          p_confirmed: boolean
          p_day: string
          p_delta: number
          p_flag: Database["public"]["Enums"]["flag_level"]
          p_inst: string
          p_mode: string
          p_region: string
          p_source: Database["public"]["Enums"]["report_source"]
          p_tactic: string
        }
        Returns: undefined
      }
      search_messages: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          body_masked: string
          campaign_id: string
          id: string
          label: Database["public"]["Enums"]["msg_label"]
          similarity: number
        }[]
      }
      similar_campaign_by_body: {
        Args: { p_body: string; p_days?: number; p_min?: number }
        Returns: {
          campaign_id: string
          similarity: number
        }[]
      }
      similar_messages: {
        Args: { p_limit?: number; p_message: string }
        Returns: {
          body_masked: string
          campaign_id: string
          created_at: string
          id: string
          similarity: number
        }[]
      }
      soc_campaign_overview: { Args: { p_weeks?: number }; Returns: Json }
      soc_institution_spikes: {
        Args: { p_min?: number; p_since: string }
        Returns: {
          count: number
          name: string
        }[]
      }
      soc_pattern_stats: { Args: { p_days?: number }; Returns: Json }
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
      intel_provider:
        | "virustotal"
        | "urlhaus"
        | "hybrid_analysis"
        | "rdap"
        | "crtsh"
        | "dns"
        | "internal"
      intel_status: "pending" | "done" | "error" | "skipped" | "unavailable"
      intel_verdict: "malicious" | "suspicious" | "clean" | "unknown"
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
      region_level: "county" | "municipality"
      region_source: "user_selected" | "institution_inferred" | "synthetic"
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
      intel_provider: [
        "virustotal",
        "urlhaus",
        "hybrid_analysis",
        "rdap",
        "crtsh",
        "dns",
        "internal",
      ],
      intel_status: ["pending", "done", "error", "skipped", "unavailable"],
      intel_verdict: ["malicious", "suspicious", "clean", "unknown"],
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
      region_level: ["county", "municipality"],
      region_source: ["user_selected", "institution_inferred", "synthetic"],
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
