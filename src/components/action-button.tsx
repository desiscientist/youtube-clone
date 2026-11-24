"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Sends a request, then refreshes the page's server data, e.g. "Remove from
 * history". Optionally asks for confirmation and redirects afterwards.
 */
export function ActionButton({
  url,
  method = "DELETE",
  confirmMessage,
  redirectTo,
  children,
  ...buttonProps
}: {
  url: string;
  method?: "DELETE" | "POST";
  confirmMessage?: string;
  redirectTo?: string;
  children: React.ReactNode;
} & Omit<ButtonProps, "onClick" | "children">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      const response = await fetch(url, { method });
      if (!response.ok) throw new Error("Request failed.");
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      window.alert("That didn't work. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={pending} onClick={run} {...buttonProps}>
      {children}
    </Button>
  );
}
