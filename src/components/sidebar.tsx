"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  Clock3,
  Compass,
  Flame,
  Gamepad2,
  House,
  ListVideo,
  Music2,
  PanelLeftClose,
  PlaySquare,
  ThumbsUp,
  Trophy,
  Video,
  WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { label: string; icon: typeof House; href: string };

const primaryLinks: NavLink[] = [
  { label: "Home", icon: House, href: "/" },
  { label: "Shorts", icon: PlaySquare, href: "/shorts" },
  { label: "Subscriptions", icon: Video, href: "/feed/subscriptions" },
];

const personalLinks: NavLink[] = [
  { label: "Your channel", icon: Compass, href: "/channel" },
  { label: "History", icon: Clock3, href: "/feed/history" },
  { label: "Playlists", icon: ListVideo, href: "/feed/playlists" },
  { label: "Watch later", icon: Clock, href: "/feed/watch-later" },
  { label: "Liked videos", icon: ThumbsUp, href: "/feed/liked" },
];

const exploreLinks: NavLink[] = [
  { label: "Trending", icon: Flame, href: "/feed/trending" },
  { label: "Music", icon: Music2, href: "/?category=Music" },
  { label: "Gaming", icon: Gamepad2, href: "/?category=Gaming" },
  { label: "Sports", icon: Trophy, href: "/?category=Sports" },
  { label: "Learning", icon: WandSparkles, href: "/?category=Education" },
];

type SidebarProps = {
  collapsed: boolean;
  onCollapse: () => void;
};

export function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-16 z-30 hidden overflow-y-auto bg-background transition-[width] duration-200 md:block",
        collapsed ? "w-[76px]" : "w-[240px]",
      )}
    >
      <nav className="px-3 py-3">
        <div className="mb-2 flex justify-end">
          {!collapsed && (
            <button
              aria-label="Collapse sidebar"
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground"
              onClick={onCollapse}
              title="Collapse sidebar"
            >
              <PanelLeftClose size={19} />
            </button>
          )}
        </div>
        <NavGroup collapsed={collapsed} links={primaryLinks} />
        <div className="my-3 border-t border-border" />
        <h2
          className={cn(
            "px-3 pb-2 text-sm font-semibold",
            collapsed && "sr-only",
          )}
        >
          You
        </h2>
        <NavGroup collapsed={collapsed} links={personalLinks} />
        <div className="my-3 border-t border-border" />
        <h2
          className={cn(
            "px-3 pb-2 text-sm font-semibold",
            collapsed && "sr-only",
          )}
        >
          Explore
        </h2>
        <NavGroup collapsed={collapsed} links={exploreLinks} />
        {!collapsed && (
          <p className="px-3 pb-6 pt-5 text-[11px] leading-4 text-muted">
            About · Press · Copyright
            <br />
            Contact · Creators · Advertise
            <br />
            Terms · Privacy · Safety
            <br />
            <span className="mt-3 inline-block">© 2026 StreamBox</span>
          </p>
        )}
      </nav>
    </aside>
  );
}

function NavGroup({
  collapsed,
  links,
}: {
  collapsed: boolean;
  links: NavLink[];
}) {
  const pathname = usePathname();

  return (
    <div className={cn("grid gap-1", collapsed && "gap-2")}>
      {links.map(({ label, icon: Icon, href }) => {
        // Category links share "/" with Home, so only exact page links light up.
        const active =
          !href.includes("?") &&
          (pathname === href ||
            (href === "/shorts" && pathname.startsWith("/shorts/")));
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-5 rounded-xl px-3 text-sm transition-colors hover:bg-surface-muted",
              collapsed &&
                "min-h-[64px] flex-col justify-center gap-1 px-1 text-[10px]",
              active && "bg-surface-muted font-semibold",
            )}
            href={href}
            key={label}
            title={collapsed ? label : undefined}
          >
            <Icon className="shrink-0" size={20} strokeWidth={1.8} />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
