/**
 * Hand-written subset of the piu-tourney-maker Supabase schema, covering only
 * the tables this app reads. Column types are transcribed from that project's
 * `src/types/{Tourney,Event,Round,RoundPool,PlayerRound,PlayerTourney}.ts`.
 *
 * That project ships no generated types and no migrations, so there is nothing
 * to run `supabase gen types` against without its project ref. If the ref
 * becomes available, a generated file can replace this one wholesale.
 *
 * Insert and Update are `never` on every table: supabase-js requires the keys
 * to be present, and typing them this way makes a write to this project fail to
 * compile rather than fail at runtime against someone else's RLS.
 *
 * Relationships are only populated for the foreign keys we actually traverse in
 * a select — they are what tells supabase-js whether an embedded relation comes
 * back as one row or many.
 */

/** no table here is writable, so every Insert/Update is uninhabited */
type ReadOnly<Row, Relationships> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: Relationships;
};

export type TourneyStatus = "Not Started" | "In Progress" | "Complete";
export type TourneyType =
  | "Gauntlet"
  | "Double Elimination"
  | "Waterfall (Redemption)";
export type RoundStatus =
  | "Not Started"
  | "Pick Ban"
  | "Ready"
  | "In Progress"
  | "Complete";

/** the only round status that means "this match is done and reported" */
export const COMPLETE: RoundStatus = "Complete";

export type Database = {
  public: {
    Tables: {
      events: ReadOnly<
        {
          id: number;
          name: string;
          thumbnail_img: string | null;
          hero_img: string | null;
          location: string | null;
          description: string | null;
          start_date: string;
          end_date: string;
          created_at: string;
        },
        []
      >;
      tourneys: ReadOnly<
        {
          id: number;
          event_id: number;
          game_id: number;
          name: string;
          start_date: string;
          end_date: string;
          status: TourneyStatus | null;
          type: TourneyType | null;
          thumbnail_img: string | null;
          stream_round_id: number | null;
          created_at: string;
        },
        [
          {
            foreignKeyName: "fk_tourneys_event_id_events";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ]
      >;
      round_pools: ReadOnly<
        {
          id: number;
          tourney_id: number;
          name: string;
          sort_order: number | null;
          chartdraw_config_id: number | null;
          created_at: string;
        },
        [
          {
            foreignKeyName: "fk_round_pools_tourney_id_tourneys";
            columns: ["tourney_id"];
            isOneToOne: false;
            referencedRelation: "tourneys";
            referencedColumns: ["id"];
          },
        ]
      >;
      rounds: ReadOnly<
        {
          id: number;
          tourney_id: number;
          name: string;
          players_advancing: number;
          status: RoundStatus | null;
          next_round_id: number | null;
          lost_next_round_id: number | null;
          parent_round_id: number | null;
          round_pool_id: number | null;
          chartdraw_config_id: number | null;
          points_per_stage: string | null;
          active_stream_state: unknown;
          created_at: string;
        },
        [
          {
            foreignKeyName: "fk_rounds_tourney_id_tourneys";
            columns: ["tourney_id"];
            isOneToOne: false;
            referencedRelation: "tourneys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_rounds_round_pool_id_round_pools";
            columns: ["round_pool_id"];
            isOneToOne: false;
            referencedRelation: "round_pools";
            referencedColumns: ["id"];
          },
        ]
      >;
      player_tourneys: ReadOnly<
        {
          id: number;
          tourney_id: number;
          player_name: string;
          seed: number | null;
          player_img: string | null;
          created_at: string;
        },
        [
          {
            foreignKeyName: "fk_player_tourneys_tourney_id_tourneys";
            columns: ["tourney_id"];
            isOneToOne: false;
            referencedRelation: "tourneys";
            referencedColumns: ["id"];
          },
        ]
      >;
      player_rounds: ReadOnly<
        {
          id: number;
          round_id: number;
          player_tourney_id: number;
          // gauntlet rounds and freshly seeded brackets leave this unset
          sort_order: number | null;
          heat: number | null;
          lane: number | null;
          created_at: string;
        },
        [
          {
            foreignKeyName: "fk_player_rounds_round_id_rounds";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_player_rounds_player_id_player_tourneys";
            columns: ["player_tourney_id"];
            isOneToOne: false;
            referencedRelation: "player_tourneys";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
