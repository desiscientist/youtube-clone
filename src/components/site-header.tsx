"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tv,
  UserRound,
} from "lucide-react";
import { NotificationsMenu } from "@/components/notifications-menu";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  /** Pre-fills the search box, e.g. on the results page. */
  initialQuery?: string;
  onSidebarToggle: () => void;
};

export function SiteHeader({ initialQuery, onSidebarToggle }: SiteHeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { data: session } = useSession();
  const displayName =
    session?.user?.name || session?.user?.email || "Your account";
  const avatarInitial = displayName.slice(0, 1).toLocaleUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-background/95 px-3 backdrop-blur md:px-6">
      <div className="flex min-w-[190px] items-center gap-3">
        <Button
          aria-label="Toggle sidebar"
          className="hidden text-foreground md:inline-flex"
          onClick={onSidebarToggle}
          size="icon"
          variant="ghost"
        >
          <Menu size={21} />
        </Button>
        <a
          aria-label="StreamBox home"
          className="flex items-center gap-2"
          href="/"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white shadow-sm shadow-accent/25">
            <Play fill="currentColor" size={18} strokeWidth={2.5} />
          </span>
          <span className="text-[20px] font-bold tracking-[-0.8px]">
            stream<span className="text-accent">box</span>
          </span>
          <span className="hidden self-start pt-0.5 text-[10px] text-muted sm:inline">
            beta
          </span>
        </a>
      </div>

      <SearchBox
        className={cn(
          "mx-auto hidden w-full max-w-[680px] sm:flex",
          mobileSearchOpen &&
            "absolute inset-x-0 top-16 z-50 flex max-w-none bg-background px-3 py-2",
        )}
        initialQuery={initialQuery}
        onSubmitted={() => setMobileSearchOpen(false)}
      />

      <div className="ml-auto flex items-center gap-1">
        <Button
          aria-expanded={mobileSearchOpen}
          aria-label="Search videos"
          className="sm:hidden"
          onClick={() => setMobileSearchOpen((open) => !open)}
          size="icon"
          variant="ghost"
        >
          <Search size={20} />
        </Button>
        {session ? (
          <>
            <Link
              className="hidden h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-sm font-medium hover:bg-surface-muted/75 md:inline-flex"
              href="/upload"
            >
              <Plus size={19} />
              Create
            </Link>
            <Link
              aria-label="Create or upload a video"
              className="grid size-10 place-items-center rounded-full hover:bg-surface-muted md:hidden"
              href="/upload"
            >
              <Plus size={21} />
            </Link>
          </>
        ) : (
          <Link
            className="hidden h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-sm font-medium hover:bg-surface-muted/75 md:inline-flex"
            href="/login"
          >
            <Plus size={19} />
            Create
          </Link>
        )}
        <NotificationsMenu signedIn={Boolean(session)} />
        <ThemeToggle />
        <details className="group relative ml-1">
          <summary
            aria-label="Open account menu"
            className={cn(
              "grid size-9 cursor-pointer list-none place-items-center rounded-full text-sm font-semibold text-white outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden",
              session
                ? "bg-gradient-to-br from-indigo-400 to-violet-700"
                : "bg-surface-muted text-foreground",
            )}
          >
            {session ? avatarInitial : <UserRound size={18} />}
          </summary>
          <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-surface p-3 shadow-xl">
            {session ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-2 pb-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-700 font-semibold text-white">
                    {avatarInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <Link className="menu-item mt-2" href="/account">
                  <UserRound size={17} /> Your account
                </Link>
                <Link className="menu-item" href="/channel">
                  <Tv size={17} /> Your channel
                </Link>
                {session.user.isAdmin && (
                  <Link className="menu-item" href="/admin/reports">
                    <ShieldCheck size={17} /> Review reports
                  </Link>
                )}
                <Link className="menu-item" href="/studio">
                  <Settings size={17} /> Creator studio
                </Link>
                <button
                  className="menu-item w-full"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  type="button"
                >
                  <LogOut size={17} /> Sign out
                </button>
              </>
            ) : (
              <div className="p-2">
                <p className="text-sm font-semibold">Your StreamBox account</p>
                <p className="mt-1 text-xs text-muted">
                  Sign in to create a channel and personalize your experience.
                </p>
                <Link
                  className="mt-4 inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-muted"
                  href="/login"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
