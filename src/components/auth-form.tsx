"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthFormProps = {
  mode: "login" | "signup";
  googleEnabled: boolean;
};

function getCallbackUrl() {
  const callbackUrl = new URLSearchParams(window.location.search).get(
    "callbackUrl",
  );
  if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return "/";
}

export function AuthForm({ mode, googleEnabled }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isSignup) {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(result.error || "Unable to create your account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error === "TooManyAttempts") {
        setError(
          "Too many sign-in attempts. Wait 15 minutes, or reset your password.",
        );
        return;
      }
      if (!result || result.error) {
        setError(
          isSignup
            ? "Account created, but sign-in failed. Please sign in with your new account."
            : "Email or password is incorrect.",
        );
        return;
      }

      window.location.assign(getCallbackUrl());
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      await signIn("google", { callbackUrl: getCallbackUrl() });
    } catch {
      setError("Google sign-in could not be started.");
      setSubmitting(false);
    }
  }

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

        <h1 className="text-2xl font-bold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isSignup
            ? "Join StreamBox and get your own creator channel."
            : "Sign in to pick up where you left off."}
        </p>

        {googleEnabled && (
          <>
            <Button
              className="mt-7 w-full"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              type="button"
              variant="outline"
            >
              <GoogleMark />
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="block space-y-1.5 text-sm font-medium">
              Name
              <input
                autoComplete="name"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                maxLength={60}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="flex items-center justify-between">
              Password
              {!isSignup && (
                <Link
                  className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              )}
            </span>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              maxLength={72}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button className="w-full" disabled={submitting} type="submit">
            {submitting && <LoaderCircle className="animate-spin" size={17} />}
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? "Already have an account?" : "New to StreamBox?"}{" "}
          <Link
            className="font-semibold text-foreground underline-offset-4 hover:underline"
            href={isSignup ? "/login" : "/signup"}
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-muted">
          By continuing, you agree to StreamBox&apos;s Terms of Service and
          Privacy Policy.
        </p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 48 48">
      <path
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
        fill="#4285F4"
      />
      <path
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
        fill="#34A853"
      />
      <path
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"
        fill="#FBBC05"
      />
      <path
        d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
        fill="#EA4335"
      />
    </svg>
  );
}
