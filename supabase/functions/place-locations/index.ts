import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { requireClerkUser } from "../_shared/clerkAuth.ts";
import {
  createLocationHandler,
  downwardLimit,
} from "../_shared/placeLocations.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(
  createLocationHandler({
    authenticate: async (request) => (await requireClerkUser(request)).userId,
    owned: async (ids, userId, request) => {
      const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        ...options,
        global: {
          headers: { Authorization: request.headers.get("Authorization")! },
        },
      });
      const { data, error } = await client
        .from("saved_places")
        .select("id,place_id")
        .eq("user_id", userId)
        .in("id", ids);
      if (error) throw new Error("unavailable");
      return data ?? [];
    },
    reserve: async (userId, count) => {
      const client = createClient(
        url,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        options,
      );
      const { data, error } = await client.rpc("reserve_map_positions", {
        subject: userId,
        attempts: count,
        user_cap: downwardLimit(Deno.env.get("MAP_USER_DAILY_LIMIT"), 60),
        project_cap: downwardLimit(
          Deno.env.get("MAP_PROJECT_DAILY_LIMIT"),
          250,
        ),
      });
      if (error) throw new Error("quota");
      return data;
    },
    apiKey: Deno.env.get("GOOGLE_PLACES_API_KEY"),
    fetch,
  }),
);
