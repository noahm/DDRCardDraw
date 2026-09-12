import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { piuClient } from "./client";
import { piuTourneyIdAtom } from "./atoms";
import type { Database, RoundStatus, TourneyType } from "./database.types";
import { COMPLETE } from "./database.types";

type Tables = Database["public"]["Tables"];

// piuTourneyIdAtom and parseTourneyId live in ./atoms so the settings tab can
// reach them without loading the Supabase client.
export { piuTourneyIdAtom, parseTourneyId } from "./atoms";

export interface QueryResult<T> {
  data: T | undefined;
  fetching: boolean;
  /** null when the query simply hasn't run (no tourney selected yet) */
  error: string | null;
}

/**
 * Minimal urql-shaped wrapper so the pickers read like their start.gg
 * counterparts. urql is bound to the start.gg GraphQL endpoint and there is no
 * general data-fetching library in this app, so this is hand-rolled.
 */
function useSupabaseQuery<T>(
  key: string | number | null,
  run: (() => Promise<T>) | null,
): [QueryResult<T>, () => void] {
  const [result, setResult] = useState<QueryResult<T>>({
    data: undefined,
    fetching: !!run,
    error: null,
  });
  // bumped by refetch() to re-run the effect without changing the key
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!run) {
      setResult({ data: undefined, fetching: false, error: null });
      return;
    }
    let cancelled = false;
    setResult((prev) => ({ ...prev, fetching: true }));
    run().then(
      (data) => {
        if (!cancelled) setResult({ data, fetching: false, error: null });
      },
      (e: unknown) => {
        if (cancelled) return;
        setResult({
          data: undefined,
          fetching: false,
          error: e instanceof Error ? e.message : String(e),
        });
      },
    );
    return () => {
      cancelled = true;
    };
    // `run` is a fresh closure every render; `key` is what actually identifies
    // the request, so that plus the refetch nonce are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return [result, refetch];
}

export interface PiuTourney {
  id: number;
  name: string;
  type: TourneyType | null;
  status: Tables["tourneys"]["Row"]["status"];
  events: { name: string } | null;
}

/** Resolves a pasted id to a real tournament, and tells us its bracket format. */
export function usePiuTourney(tourneyId: number | null) {
  const client = piuClient;
  return useSupabaseQuery<PiuTourney>(
    tourneyId,
    client && tourneyId
      ? async () => {
          const { data, error } = await client
            .from("tourneys")
            .select("id, name, type, status, events(name)")
            .eq("id", tourneyId)
            .single();
          if (error) throw new Error(error.message);
          return data;
        }
      : null,
  );
}

export interface PiuEntrant {
  id: number;
  /** unset on gauntlet rounds and on brackets that haven't been seeded yet */
  sort_order: number | null;
  player_tourney_id: number;
  player_tourneys: { player_name: string; seed: number | null } | null;
}

export interface PiuMatch {
  id: number;
  name: string;
  status: RoundStatus | null;
  round_pools: { id: number; name: string; sort_order: number | null } | null;
  player_rounds: PiuEntrant[];
}

/**
 * Every match in a tournament that hasn't been closed out yet, with its phase
 * and entrants in one round trip.
 *
 * In tourney-maker a `rounds` row *is* a match: the bracket generator writes
 * one per template match id ("WSF:M1") under a `round_pools` row per phase.
 * Gauntlet-format tournaments put every entrant in a single round instead.
 */
export function usePiuMatches(tourneyId: number | null) {
  const client = piuClient;
  return useSupabaseQuery<PiuMatch[]>(
    tourneyId,
    client && tourneyId
      ? async () => {
          const { data, error } = await client
            .from("rounds")
            .select(
              `id, name, status, round_pool_id,
               round_pools ( id, name, sort_order ),
               player_rounds (
                 id, sort_order, player_tourney_id,
                 player_tourneys ( player_name, seed )
               )`,
            )
            .eq("tourney_id", tourneyId)
            // status is nullable, and `status <> 'Complete'` is NULL (i.e.
            // false) for a NULL status, so a bare .neq() would silently drop
            // freshly created rounds.
            .or(`status.is.null,status.neq.${COMPLETE}`)
            .order("id", { ascending: true });
          if (error) throw new Error(error.message);
          return data ?? [];
        }
      : null,
  );
}

/** The tourney id currently selected on this device. */
export function usePiuTourneyId() {
  return useAtomValue(piuTourneyIdAtom);
}
