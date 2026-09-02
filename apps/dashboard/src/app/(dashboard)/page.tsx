import { auth } from "@retransmit/auth";
import { headers } from "next/headers";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="text-muted-foreground">
        Welcome back, {session?.user.name}. Add a domain, create an API key,
        and start sending.
      </p>
    </div>
  );
}
