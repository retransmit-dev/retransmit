import { AppSidebar } from "@/components/app-sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@retransmit/auth";
import { headers } from "next/headers";
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

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <AppSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />

      <SidebarInset className="min-h-0 overflow-hidden">
        <MobileTopBar />
        {/*
         * The scroll container and the only place page padding is set. Screens
         * start below the inset's top edge rather than against it, and every
         * one of them shares the same left edge — `PageShell` caps the column
         * width from that edge instead of centring it.
         */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4 pb-8 sm:px-6 sm:pt-6">
          {props.children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
