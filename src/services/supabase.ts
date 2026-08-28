/**
 * Supabase client and rating helpers for Oasis.
 *
 * Required environment variables (add to .env):
 *   VITE_SUPABASE_URL      – Project URL from Supabase › Settings › API
 *   VITE_SUPABASE_ANON_KEY – Anon/public key (safe to expose; RLS enforces access)
 *
 * NEVER add SUPABASE_SERVICE_ROLE_KEY here – keep it in Edge Functions only.
 *
 * Install dependency:
 *   npm install @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js';

// ── Client ────────────────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    // Fail loudly during development; the app should still load in production
    // if the env vars are injected by the build system.
    console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ─────────────────────────────────────────────────────────────────────

export type Rating = {
    id: string;
    fountain_id: string;
    name?: string;
    rating: number;
    comment?: string;
    lat?: number;
    lng?: number;
    metadata?: Record<string, unknown>;
    user_id?: string;
    created_at: string;
};

export type Aggregate = {
    fountain_id: string;
    rating_count: number;
    rating_avg: number | null;
};

export type SubmitRatingParams = {
    fountainId: string;
    name?: string;
    rating: number;
    comment?: string;
    lat?: number;
    lng?: number;
    /** Arbitrary metadata (OSM tags, potability inference, user-agent, etc.) */
    metadata?: Record<string, unknown>;
    userId?: string;
};

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert a new rating for a fountain.
 * Requires an authenticated session (Variant A) or a trusted Edge Function
 * with service_role (Variant B – change the fetch target accordingly).
 */
export async function submitRating(params: SubmitRatingParams): Promise<Rating> {
    const { fountainId, name, rating, comment, lat, lng, metadata, userId } = params;

    const payload: Omit<Rating, 'id' | 'created_at'> = {
        fountain_id: fountainId,
        name: name ?? undefined,
        rating,
        comment: comment ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        metadata: {
            ...metadata,
            user_agent: navigator.userAgent,
        },
        user_id: userId ?? undefined,
    };

    const { data, error } = await supabase
        .from('ratings')
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data as Rating;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch aggregated rating stats for a single fountain.
 * Returns null if no ratings exist yet.
 */
export async function getAggregates(fountainId: string): Promise<Aggregate | null> {
    const { data, error } = await supabase
        .from('fountain_rating_aggregates')
        .select('fountain_id, rating_count, rating_avg')
        .eq('fountain_id', fountainId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data as Aggregate | null;
}

/**
 * Fetch the most recent ratings for a fountain, newest first.
 */
export async function getRatings(
    fountainId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<Rating[]> {
    const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('fountain_id', fountainId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return (data ?? []) as Rating[];
}

// ── Realtime (optional) ───────────────────────────────────────────────────────

/**
 * Subscribe to new ratings for a fountain in real-time.
 * Returns a cleanup function to unsubscribe.
 *
 * Usage:
 *   const unsub = subscribeRatings(fountainId, (newRating) => { ... });
 *   // later:
 *   unsub();
 */
export function subscribeRatings(
    fountainId: string,
    callback: (rating: Rating) => void
): () => void {
    const channel = supabase
        .channel(`ratings:${fountainId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'ratings',
                filter: `fountain_id=eq.${fountainId}`,
            },
            (payload) => callback(payload.new as Rating)
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
