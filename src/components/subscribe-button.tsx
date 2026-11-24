"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { redirectToLogin } from "@/lib/login-redirect";
import { cn } from "@/lib/utils";

export function SubscribeButton({
  channelId,
  signedIn,
  initialSubscribed,
  onCountChange,
}: {
  channelId: string;
  signedIn: boolean;
  initialSubscribed: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!signedIn) return redirectToLogin();
    const next = !subscribed;
    setSubscribed(next);
    setPending(true);
    try {
      const response = await fetch(`/api/channels/${channelId}/subscribe`, {
        method: next ? "POST" : "DELETE",
      });
      if (response.status === 401) return redirectToLogin();
      if (!response.ok) throw new Error("Subscription failed.");
      const result = (await response.json()) as {
        subscribed: boolean;
        subscriberCount: number;
      };
      setSubscribed(result.subscribed);
      onCountChange?.(result.subscriberCount);
    } catch {
      setSubscribed(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-pressed={subscribed}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60",
        subscribed
          ? "bg-surface-muted text-foreground hover:bg-surface-muted/75"
          : "bg-foreground text-background hover:bg-foreground/85",
      )}
      disabled={pending}
      onClick={toggle}
      type="button"
    >
      {subscribed && <BellRing size={16} />}
      {subscribed ? "Subscribed" : "Subscribe"}
    </button>
  );
}
