import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowLeft, CircleUserRound } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const channel = await prisma.channel.findUnique({
    where: { userId: session.user.id },
    select: { name: true, handle: true, description: true },
  });

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        href="/"
      >
        <ArrowLeft size={17} /> Back to StreamBox
      </Link>
      <section className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-9">
        <span className="grid size-14 place-items-center rounded-full bg-accent/10 text-accent">
          <CircleUserRound size={28} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Your account</h1>
        <p className="mt-2 text-sm text-muted">
          Signed in as {session.user.email}
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Account name
            </p>
            <p className="mt-2 font-semibold">
              {session.user.name || "Creator"}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-muted p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Channel
            </p>
            <p className="mt-2 font-semibold">
              {channel?.name || "Your channel"}
            </p>
            {channel && (
              <p className="mt-1 text-sm text-muted">@{channel.handle}</p>
            )}
          </div>
        </div>

        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-surface-muted px-4 text-sm font-medium hover:bg-surface-muted/75"
          href="/studio"
        >
          Open creator studio
        </Link>
      </section>
    </main>
  );
}
