import { BrandMark } from "@/components/brand-mark";
import { LoginShowcase } from "@/components/login/login-showcase";

const SITE_URL = "https://retransmit.dev";

function BrandLink({ className }: { className?: string }) {
  return (
    <a
      href={SITE_URL}
      className={className}
      aria-label="Retransmit, back to the website"
    >
      <BrandMark className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
    </a>
  );
}

/**
 * The sign-in shell shared by every page under /login. Two halves on wide
 * screens: the product sketch on the darker canvas to the left, the form on
 * the pane to the right. On narrow screens only the form remains, with the
 * wordmark above it. The wordmark links back to the public site.
 */
export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="row-span-2 grid min-h-0 overflow-y-auto lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar px-10 py-8 lg:flex xl:px-16">
        <BrandLink className="self-start" />
        <div className="flex flex-1 items-center py-10">
          <LoginShowcase />
        </div>
        <p className="text-xs text-muted-foreground">
          <a
            href="https://docs.retransmit.dev"
            className="hover:text-foreground"
          >
            Documentation
          </a>
        </p>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-10">
        <BrandLink className="self-start lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
