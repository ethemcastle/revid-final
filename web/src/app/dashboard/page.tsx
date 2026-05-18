import { createSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmitUrlForm } from "./submit-url-form";
import { PropertyList } from "./property-list";
import { WorkerStatusBadge } from "./worker-status-badge";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("property_listings")
    .select("id, url, status, address, price, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-4">
          <WorkerStatusBadge />
          <SignOutButton />
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-medium">Add Property</h2>
        <SubmitUrlForm />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-medium">Your Properties</h2>
        <PropertyList listings={listings ?? []} />
      </section>
    </main>
  );
}

