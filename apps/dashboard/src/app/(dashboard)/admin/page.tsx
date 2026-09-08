import { SmsProvidersTable } from "@/components/admin/sms-providers";
import { SmsSenderQueue } from "@/components/admin/sms-sender-queue";
import { UsersTable } from "@/components/admin/users-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { auth } from "@retransmit/auth";
import { isAdminEmail } from "@retransmit/auth/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const metadata = navMetadata("/admin");

/** A titled block on the operator page. Sections are independent; one failing
 * to load must not take the others with it, hence the boundary per section. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium text-lg">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <ErrorBoundary title={`Could not load ${title.toLowerCase()}`}>{children}</ErrorBoundary>
    </section>
  );
}

/**
 * Operator-only. The layout already guarantees a session; this page also
 * checks the allowlist and answers 404 to anyone else, so the route does not
 * reveal itself. Every tRPC procedure behind these sections makes the same
 * check.
 */
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!isAdminEmail(session?.user.email)) notFound();

  batchPrefetch([
    trpc.admin.users.queryOptions(),
    trpc.smsSender.queue.queryOptions(),
    trpc.admin.smsProviders.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/admin" />

        <Section
          title="Sender ID requests"
          description="Register the approved ones upstream, then record the outcome here. Approving is what lets an organization send with the name."
        >
          <SmsSenderQueue />
        </Section>

        <Section
          title="SMS routing"
          description="Providers this deployment has credentials for. Routing picks the cheapest one covering the destination; customers never choose."
        >
          <SmsProvidersTable />
        </Section>

        <Section title="Users" description="Registered users and when they last connected.">
          <UsersTable />
        </Section>
      </PageShell>
    </HydrateClient>
  );
}
