"use client";

import { useEffect, useMemo, useState } from "react";

type WorkerStatusResponse = {
  status: "ok" | "down";
  lastSeenAt: string | null;
  ageSeconds: number | null;
};

const POLL_MS = 15_000;

export function WorkerStatusBadge() {
  const [status, setStatus] = useState<WorkerStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/worker-status", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const payload: WorkerStatusResponse = await response.json();
        if (isMounted) {
          setStatus(payload);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
    };

    void loadStatus();
    const interval = setInterval(loadStatus, POLL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const badge = useMemo(() => {
    if (error) {
      return {
        label: "Worker Unknown",
        tone: "bg-amber-100 text-amber-800 border-amber-300",
      };
    }

    if (!status) {
      return {
        label: "Checking Worker",
        tone: "bg-zinc-100 text-zinc-800 border-zinc-300",
      };
    }

    return status.status === "ok"
      ? {
          label: "Worker OK",
          tone: "bg-emerald-100 text-emerald-800 border-emerald-300",
        }
      : {
          label: "Worker Down",
          tone: "bg-rose-100 text-rose-800 border-rose-300",
        };
  }, [error, status]);

  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${badge.tone}`}>
        {badge.label}
      </span>
      {status?.lastSeenAt ? (
        <span className="text-xs text-zinc-600">
          Last heartbeat: {new Date(status.lastSeenAt).toLocaleString()} ({status.ageSeconds}s ago)
        </span>
      ) : null}
      {error ? <span className="text-xs text-amber-700">{error}</span> : null}
    </div>
  );
}

