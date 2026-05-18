"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Listing = {
  id: string;
  url: string;
  status: string;
  address: string | null;
  price: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  tracked: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

const POLL_MS = 10_000;

export function PropertyList({ listings: initial }: { listings: Listing[] }) {
  const [listings, setListings] = useState<Listing[]>(initial);

  useEffect(() => {
    let mounted = true;

    const fetchListings = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("property_listings")
        .select("id, url, status, address, price, created_at")
        .order("created_at", { ascending: false });

      if (mounted && data) {
        setListings(data as Listing[]);
      }
    };

    const interval = setInterval(fetchListings, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Also sync when initial props change (e.g. after form submit + router.refresh)
  useEffect(() => {
    setListings(initial);
  }, [initial]);

  if (listings.length === 0) {
    return <p className="text-sm text-zinc-500">No properties yet. Add one above.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-700">
          <tr>
            <th className="px-3 py-2">Address</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">URL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td className="px-3 py-2 font-medium">
                {listing.address ?? "—"}
              </td>
              <td className="px-3 py-2">{listing.price ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[listing.status] ?? "bg-zinc-100 text-zinc-800"}`}
                >
                  {listing.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {(() => { try { return new URL(listing.url).hostname; } catch { return listing.url; } })()}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
