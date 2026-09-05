import { AppSidebar } from "@/components/app-sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@retransmit/auth";
import { isAdminEmail } from "@retransmit/auth/admin";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export default async function Layout(props: PropsWithChildren) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/login");
  }

  // Every session is created with an active organization, and the user's
  // personal organization is created on first sign-in, so the list is never
  // empty. The fallback covers a session whose active organization the user
  // has since left.
  const organizations = await auth.api.listOrganizations({
    headers: requestHeaders,
  });
  const workspaces = organizations.map(({ id, name }) => ({ id, name }));
  const activeWorkspaceId =
    workspaces.find(
      (workspace) => workspace.id === session.session.activeOrganizationId,
    )?.id ?? workspaces[0]?.id;

  if (!activeWorkspaceId) {
    redirect("/login");
  }

  // The sidebar saves each toggle to this cookie; reading it here keeps the
  // collapsed state across reloads instead of snapping open on every visit.
  const sidebarOpen =
    (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={sidebarOpen}
      className="h-svh min-h-0 overflow-hidden"
    >
      <AppSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        isAdmin={isAdminEmail(session.user.email)}
      />

      <SidebarInset className="min-h-0 overflow-hidden">
        <MobileTopBar />
        {/*
         * The scroll container and the only place page padding is set. Screens
         * start below the inset's top edge rather than against it, and every
         * one of them fills this box — `PageShell` only caps and centres the
         * column once the inset grows past its widest size.
         */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4 pb-8 sm:px-6 sm:pt-6">
          {props.children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
