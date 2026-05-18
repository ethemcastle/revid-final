import "dotenv/config";

import { parsePropertyDetails } from "./parser.js";
import { scrapeMarkdown } from "./firecrawl.js";
import { getSupabase } from "./supabase.js";

const POLL_MS = 15_000;

type PendingListing = {
  id: string;
  url: string;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeHeartbeat() {
  const supabase = getSupabase();

  // Try update first, then insert if no row exists
  const { data, error: updateError } = await supabase
    .from("worker_heartbeats")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", "singleton")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error(`Heartbeat update failed: ${updateError.message}`);
    return;
  }

  if (!data) {
    const { error: insertError } = await supabase
      .from("worker_heartbeats")
      .insert({ id: "singleton", last_seen: new Date().toISOString() });

    if (insertError) {
      console.error(`Heartbeat insert failed: ${insertError.message}`);
    }
  }
}

async function claimNextPending(): Promise<PendingListing | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("property_listings")
    .select("id,url")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<PendingListing>();

  if (error) {
    throw new Error(`Fetch pending failed: ${error.message}`);
  }

  if (!data) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("property_listings")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("status", "pending")
    .select("id,url")
    .maybeSingle<PendingListing>();

  if (claimError) {
    throw new Error(`Claim pending failed: ${claimError.message}`);
  }

  return claimed ?? null;
}

async function processListing(listing: PendingListing) {
  const supabase = getSupabase();
  console.log(`Processing ${listing.id}: ${listing.url}`);

  try {
    const { markdown } = await scrapeMarkdown(listing.url);
    const { address, price } = parsePropertyDetails(markdown);

    const { error } = await supabase
      .from("property_listings")
      .update({
        status: "tracked",
        raw_markdown: markdown,
        address,
        price,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (error) {
      throw new Error(`Persist tracked failed: ${error.message}`);
    }

    console.log(`Tracked ${listing.id}: address="${address}", price="${price}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    console.error(`Failed ${listing.id}: ${message}`);

    const { error: updateError } = await supabase
      .from("property_listings")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (updateError) {
      console.error(`Persist failed state failed: ${updateError.message}`);
    }
  }
}

async function run() {
  console.log("Worker started – polling every 15s");

  getSupabase();

  while (true) {
    try {
      await writeHeartbeat();
      const listing = await claimNextPending();
      if (listing) {
        await processListing(listing);
      }
    } catch (error) {
      console.error("Worker iteration failed:", error);
    }

    await sleep(POLL_MS);
  }
}

run().catch((error) => {
  console.error("Worker crashed:", error);
  process.exit(1);
});
