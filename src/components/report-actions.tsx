"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dismiss or remove buttons for one reported item on the admin page. */
export function ReportActions({
  reportId,
  kind,
  contentGone,
}: {
  reportId: string;
  kind: "video" | "comment";
  contentGone: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"dismiss" | "remove" | null>(null);
  const [error, setError] = useState("");

  async function decide(action: "dismiss" | "remove") {
    if (
      action === "remove" &&
      !window.confirm(
        `Remove this ${kind} for everyone? ${kind === "video" ? "Its files, comments, and likes are deleted too. " : ""}This can't be undone.`,
      )
    ) {
      return;
    }
    setPending(action);
    setError("");
    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(null);
    if (!response.ok) {
      setError("That didn't work. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        disabled={pending !== null}
        onClick={() => decide("dismiss")}
        size="sm"
        variant="secondary"
      >
        <Check size={16} /> {contentGone ? "Close report" : "Keep it (dismiss)"}
      </Button>
      {!contentGone && (
        <Button
          disabled={pending !== null}
          onClick={() => decide("remove")}
          size="sm"
        >
          <Trash2 size={16} /> Remove {kind}
        </Button>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
