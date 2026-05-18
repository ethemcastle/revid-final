import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const DOWN_THRESHOLD_SECONDS = 45;

type HeartbeatRow = {
  id: string;
  last_seen: string;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("worker_heartbeats")
      .select("id,last_seen")
      .eq("id", "singleton")
      .maybeSingle<HeartbeatRow>();

    if (error) {
      return Response.json({ status: "down", lastSeenAt: null, ageSeconds: null, error: error.message }, { status: 500 });
    }

    if (!data?.last_seen) {
      return Response.json({ status: "down", lastSeenAt: null, ageSeconds: null });
    }

    const ageSeconds = Math.floor((Date.now() - Date.parse(data.last_seen)) / 1000);
    const status = ageSeconds <= DOWN_THRESHOLD_SECONDS ? "ok" : "down";

    return Response.json({
      status,
      lastSeenAt: data.last_seen,
      ageSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return Response.json({ status: "down", lastSeenAt: null, ageSeconds: null, error: message }, { status: 500 });
  }
}
