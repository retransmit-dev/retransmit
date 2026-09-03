import { PageHeader, PageShell } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { auth } from "@retransmit/auth";
import { headers } from "next/headers";

export const metadata = navMetadata("/");

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <PageShell>
      <PageHeader
        href="/"
        description={`Welcome back, ${session?.user.name}. Add a domain, create an API key, and start sending.`}
      />
    </PageShell>
  );
}
