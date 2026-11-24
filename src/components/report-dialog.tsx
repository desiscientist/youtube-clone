"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Flag, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirectToLogin } from "@/lib/login-redirect";
import { REPORT_REASONS } from "@/lib/reports";
import { cn } from "@/lib/utils";

/** A small ⋮ dropdown. Items close the menu when chosen. */
export function MoreMenu({
  label,
  items,
  className,
  align = "right",
}: {
  label: string;
  items: { label: string; icon?: React.ReactNode; onSelect: () => void }[];
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

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

  if (items.length === 0) return null;
  return (
    <div className={cn("relative", className)} ref={container}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        size="icon-sm"
        variant="ghost"
      >
        <MoreVertical size={17} />
      </Button>
      {open && (
        <div
          className={cn(
            "absolute top-10 z-40 min-w-44 rounded-xl border border-border bg-surface py-1.5 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {items.map((item) => (
            <button
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-muted"
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Modal for reporting a video or a comment. */
export function ReportDialog({
  target,
  onClose,
}: {
  target: { videoId: string } | { commentId: string };
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;
    setState("sending");
    setError("");
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, reason, details }),
    });
    if (response.status === 401) return redirectToLogin();
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error || "The report couldn't be sent.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  const kind = "videoId" in target ? "video" : "comment";
  return (
    <dialog
      aria-labelledby="report-title"
      className="w-[min(440px,calc(100vw-32px))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      onClose={onClose}
      ref={dialog}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold" id="report-title">
          <Flag size={17} /> Report {kind}
        </h2>
        <Button
          aria-label="Close"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <X size={17} />
        </Button>
      </div>
      {state === "sent" ? (
        <div className="p-5">
          <p className="font-medium">Thanks for reporting.</p>
          <p className="mt-1 text-sm text-muted">
            Our moderators will review this {kind}. We&apos;ll take it down if
            it breaks the rules.
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form className="p-5" onSubmit={submit}>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">
              What&apos;s going on?
            </legend>
            <div className="grid gap-1">
              {REPORT_REASONS.map((option) => (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted"
                  key={option}
                >
                  <input
                    checked={reason === option}
                    className="accent-[rgb(var(--accent))]"
                    name="reason"
                    onChange={() => setReason(option)}
                    type="radio"
                    value={option}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 grid gap-1 text-sm">
            <span className="text-muted">Details (optional)</span>
            <textarea
              className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sky-500"
              maxLength={500}
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
          </label>
          {error && <p className="mt-3 text-sm text-accent">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={!reason || state === "sending"} type="submit">
              {state === "sending" ? "Sending…" : "Report"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
