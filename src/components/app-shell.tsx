"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, House, PlaySquare, Plus, Video } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  /** Pre-fills the header search box. */
  initialQuery?: string;
  className?: string;
};

/** Header, sidebar, and mobile navigation shared by every browsing page. */
export function AppShell({ children, initialQuery, className }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        initialQuery={initialQuery}
        onSidebarToggle={() => setCollapsed((value) => !value)}
      />
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(true)} />
      <main
        className={cn(
          "min-h-[calc(100vh-64px)] pb-24 transition-[padding] duration-200",
          collapsed ? "md:pl-[76px]" : "md:pl-[240px]",
          className,
        )}
      >
        {children}
      </main>
      <MobileNavigation />
    </div>
  );
}

const mobileLinks = [
  { label: "Home", icon: House, href: "/" },
  { label: "Shorts", icon: PlaySquare, href: "/shorts" },
  { label: "Create", icon: Plus, href: "/upload" },
  { label: "Subscriptions", icon: Video, href: "/feed/subscriptions" },
  { label: "You", icon: CircleUserRound, href: "/channel" },
];

function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden"
    >
      {mobileLinks.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]",
              active ? "font-semibold text-foreground" : "text-muted",
            )}
            href={link.href}
            key={link.label}
          >
            <span
              className={cn(
                "grid size-7 place-items-center",
                link.label === "Create" &&
                  "rounded-full bg-foreground text-background",
              )}
            >
              <link.icon size={link.label === "Create" ? 20 : 21} />
            </span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** A page title with an optional subtitle and actions on the right. */
export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyPanel({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-border px-6 text-center">
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      </div>
    </div>
  );
}
