/**
 * Hand-written to match supabase/migrations/0001_init.sql.
 *
 * Once the project is linked to a real Supabase instance, regenerate this
 * from the live schema instead of hand-editing it:
 *   npx supabase gen types typescript --linked > lib/supabase/types.ts
 */
export type ModelStatus = "pending" | "processing" | "ready" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          credits: number;
          plan: string;
          stripe_customer_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          credits?: number;
          plan?: string;
          stripe_customer_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      models: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          status: ModelStatus;
          source_image_key: string;
          glb_url: string | null;
          usdz_url: string | null;
          render_url: string | null;
          provider: string | null;
          provider_job_id: string | null;
          usdz_provider_job_id: string | null;
          idempotency_key: string | null;
          size_retry_count: number;
          bbox_width_m: number | null;
          bbox_depth_m: number | null;
          bbox_height_m: number | null;
          source_image_width: number | null;
          source_image_height: number | null;
          scale: number;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          status?: ModelStatus;
          source_image_key: string;
          glb_url?: string | null;
          usdz_url?: string | null;
          render_url?: string | null;
          provider?: string | null;
          provider_job_id?: string | null;
          usdz_provider_job_id?: string | null;
          idempotency_key?: string | null;
          size_retry_count?: number;
          bbox_width_m?: number | null;
          bbox_depth_m?: number | null;
          bbox_height_m?: number | null;
          source_image_width?: number | null;
          source_image_height?: number | null;
          scale?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["models"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_credit: {
        Args: { uid: string };
        Returns: boolean;
      };
      refund_credit: {
        Args: { model_id: string; failure_reason?: string | null };
        Returns: boolean;
      };
    };
  };
}
