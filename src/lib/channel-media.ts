import { getStoredFilePath } from "@/lib/storage/storage";

export type ChannelImageKind = "avatar" | "banner";

export function isChannelImageKind(value: string): value is ChannelImageKind {
  return value === "avatar" || value === "banner";
}

/** Channel images live beside video folders, under "channel-<id>". */
export function channelImagePath(
  channelId: string,
  kind: ChannelImageKind,
  extension: string,
) {
  return getStoredFilePath(`channel-${channelId}`, `${kind}.${extension}`);
}

/** The version query changes on every upload so browsers fetch the new image. */
export function channelImageUrl(
  channelId: string,
  kind: ChannelImageKind,
  extension: string,
) {
  return `/api/channel-media/${channelId}/${kind}.${extension}?v=${Date.now()}`;
}
