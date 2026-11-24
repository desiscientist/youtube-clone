import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell, EmptyPanel, PageHeading } from "@/components/app-shell";
import { ChannelSettingsForm } from "@/components/channel-settings-form";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { colorFor, initials } from "@/lib/videos";

export default async function ChannelSettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // middleware sends visitors to sign in

  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: {
      name: true,
      handle: true,
      description: true,
      avatarUrl: true,
      bannerUrl: true,
    },
  });

  return (
    <AppShell className="px-4 pt-6 sm:px-6 xl:px-8">
      <Link
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        href="/studio"
      >
        <ArrowLeft size={16} /> Creator studio
      </Link>
      <PageHeading
        subtitle="Change how your channel looks to viewers."
        title="Customize channel"
      />
      {channel ? (
        <ChannelSettingsForm
          channel={{
            ...channel,
            color: colorFor(channel.name),
            initials: initials(channel.name),
          }}
        />
      ) : (
        <EmptyPanel title="You don't have a channel yet">
          Sign out and back in to create one.
        </EmptyPanel>
      )}
    </AppShell>
  );
}
