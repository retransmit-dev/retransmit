import { AdminTabs } from "@/components/admin/tabs";
import { PageHeader, PageShell } from "@/components/page-shell";
import { auth } from "@retransmit/auth";
import { isAdminEmail } from "@retransmit/auth/admin";
import { isCloudMode } from "@retransmit/billing/mode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { PropsWithChildren } from "react";

/**
 * The operator screen: one page per tab, this layout owns the strip that
 * switches between them.
 *
 * The allowlist check lives here rather than in each page so a new tab is
 * protected by existing, not by remembering. The `(dashboard)` layout already
 * guarantees a session; this answers 404 rather than 403 so the route does not
 * reveal itself to anyone else. Every tRPC procedure behind these tabs makes
 * the same check — this only hides the screen.
 */
export default async function AdminLayout({ children }: PropsWithChildren) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!isAdminEmail(session?.user.email)) notFound();

  return (
    <PageShell>
      <PageHeader href="/admin" className="gap-4">
        <AdminTabs isCloud={isCloudMode()} />
      </PageHeader>

      {children}
    </PageShell>
  );
}
