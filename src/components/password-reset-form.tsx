"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-[440px] rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-black/5 sm:p-9">
        <Link
          aria-label="StreamBox home"
          className="mb-8 inline-flex items-center gap-2"
          href="/"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white">
            <Play fill="currentColor" size={18} />
          </span>
          <span className="text-xl font-bold tracking-tight">
            stream<span className="text-accent">box</span>
          </span>
        </Link>
        {children}
      </section>
    </main>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
      role="alert"
    >
      {children}
    </p>
  );
}

/** Step 1: ask for the email address and send a reset link. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {sent ? (
        <>
          <CheckCircle2 className="text-emerald-500" size={36} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a
            link to reset its password. It works once and expires in 1 hour.
          </p>
          <Link
            className="mt-6 inline-block text-sm font-semibold underline-offset-4 hover:underline"
            href="/login"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter your account&apos;s email and we&apos;ll send you a reset
            link.
          </p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5 text-sm font-medium">
              Email
              <input
                autoComplete="email"
                className={inputClass}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle className="animate-spin" size={17} />
              )}
              Send reset link
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Remembered it?{" "}
            <Link
              className="font-semibold text-foreground underline-offset-4 hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </Card>
  );
}

/** Step 2: choose a new password using the link from the email. */
export function ResetPasswordForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setDone(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!email || !token) {
    return (
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">
          This link is incomplete
        </h1>
        <p className="mt-2 text-sm text-muted">
          Open the link from your email again, or request a new one.
        </p>
        <Link
          className="mt-6 inline-block text-sm font-semibold underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          Request a new link
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      {done ? (
        <>
          <CheckCircle2 className="text-emerald-500" size={36} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Password changed
          </h1>
          <p className="mt-2 text-sm text-muted">
            You can now sign in with your new password.
          </p>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white hover:bg-accent/90"
            href="/login"
          >
            Sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm text-muted">For {email}</p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5 text-sm font-medium">
              New password
              <input
                autoComplete="new-password"
                className={inputClass}
                maxLength={72}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Confirm new password
              <input
                autoComplete="new-password"
                className={inputClass}
                maxLength={72}
                minLength={8}
                onChange={(event) => setConfirm(event.target.value)}
                required
                type="password"
                value={confirm}
              />
            </label>
            {error && (
              <ErrorMessage>
                {error}{" "}
                {error.includes("Request a new one") && (
                  <Link
                    className="font-semibold underline"
                    href="/forgot-password"
                  >
                    Request a new link
                  </Link>
                )}
              </ErrorMessage>
            )}
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting && (
                <LoaderCircle className="animate-spin" size={17} />
              )}
              Change password
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
