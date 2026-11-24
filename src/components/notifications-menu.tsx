"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationData } from "@/app/api/notifications/route";

type NotificationsResponse = {
  notifications: NotificationData[];
  unreadCount: number;
};

const queryKey = ["notifications"];

export function NotificationsMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: signedIn,
    refetchInterval: 60_000,
    queryFn: async (): Promise<NotificationsResponse> => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Could not load notifications.");
      return response.json();
    },
  });

  const markRead = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "POST" }),
    onSuccess: () => {
      // Keep the items highlighted while the panel is open; only clear the dot.
      queryClient.setQueryData<NotificationsResponse>(queryKey, (current) =>
        current ? { ...current, unreadCount: 0 } : current,
      );
    },
  });

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && data && data.unreadCount > 0) markRead.mutate();
    if (!next) queryClient.invalidateQueries({ queryKey });
  }

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={container}>
      <Button
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        onClick={toggle}
        size="icon"
        variant="ghost"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full border border-background bg-accent px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            <Button
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              size="icon-sm"
              variant="ghost"
            >
              <X size={18} />
            </Button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {!signedIn ? (
              <EmptyState>
                <Link className="font-semibold text-accent" href="/login">
                  Sign in
                </Link>{" "}
                to get updates from channels you subscribe to.
              </EmptyState>
            ) : isLoading ? (
              <p className="p-3 text-sm text-muted">Loading…</p>
            ) : data && data.notifications.length > 0 ? (
              <ul>
                {data.notifications.map((notification) => (
                  <li key={notification.id}>
                    <Link
                      className={cn(
                        "flex gap-3 rounded-xl p-3 text-sm leading-5 hover:bg-surface-muted",
                        notification.unread && "bg-accent/5",
                      )}
                      href={notification.href}
                      onClick={() => setOpen(false)}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-2 size-1.5 shrink-0 rounded-full",
                          notification.unread ? "bg-accent" : "bg-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {notification.posted}
                        </span>
                      </span>
                      {notification.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="aspect-video w-20 shrink-0 rounded-lg object-cover"
                          src={notification.thumbnail}
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>
                You&apos;re all caught up. New uploads, comments, and
                subscribers will show up here.
              </EmptyState>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface-muted p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        <Check size={18} />
      </span>
      <p className="text-sm leading-5 text-muted">{children}</p>
    </div>
  );
}
