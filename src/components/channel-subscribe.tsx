"use client";

import { useState } from "react";
import { SubscribeButton } from "@/components/subscribe-button";
import { formatSubscribers } from "@/lib/videos";

/** Channel page header line with a subscriber count that updates on click. */
export function ChannelSubscribe({
  handle,
  channelId,
  videoCount,
  initialSubscriberCount,
  initialSubscribed,
  signedIn,
  isOwnChannel,
  ownerAction,
}: {
  handle: string;
  channelId: string;
  videoCount: number;
  initialSubscriberCount: number;
  initialSubscribed: boolean;
  signedIn: boolean;
  isOwnChannel: boolean;
  ownerAction: React.ReactNode;
}) {
  const [count, setCount] = useState(initialSubscriberCount);

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        @{handle} <span aria-hidden="true">·</span> {formatSubscribers(count)}{" "}
        <span aria-hidden="true">·</span> {videoCount}{" "}
        {videoCount === 1 ? "video" : "videos"}
      </p>
      <div className="mt-4">
        {isOwnChannel ? (
          ownerAction
        ) : (
          <SubscribeButton
            channelId={channelId}
            initialSubscribed={initialSubscribed}
            onCountChange={setCount}
            signedIn={signedIn}
          />
        )}
      </div>
    </>
  );
}
