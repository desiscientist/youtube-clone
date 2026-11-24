import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { shorts, videos } from "../src/data/videos";

const prisma = new PrismaClient();
const demoPassword = "StreamBoxDemo2026!";
// Generated clips served from public/samples. Their real lengths are used so
// progress bars and "resume where you left off" behave like real videos.
const SAMPLE_VIDEO_SECONDS = 90;
const SAMPLE_SHORT_SECONDS = 20;
const sampleVideoUrl = (index: number) =>
  `/samples/sample-${(index % 3) + 1}.mp4`;
const sampleShortUrl = (index: number) =>
  `/samples/short-${(index % 2) + 1}.mp4`;

function slug(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "creator"
  );
}

async function main() {
  const passwordHash = await hash(demoPassword, 12);
  const channels = new Map<string, (typeof videos)[number]>();
  for (const video of videos) {
    if (!channels.has(video.channel)) channels.set(video.channel, video);
  }

  const channelRecords = new Map<
    string,
    { userId: string; channelId: string; name: string }
  >();

  for (const [channelName, sample] of Array.from(channels.entries())) {
    const email = `${slug(channelName)}@streambox.demo`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: channelName,
        passwordHash,
        channel: {
          create: {
            name: channelName,
            handle: slug(channelName),
            description: `${channelName} shares thoughtful videos on ${sample.category.toLocaleLowerCase()} and the things that make life interesting.`,
            avatarUrl: null,
            bannerUrl: null,
          },
        },
      },
      include: { channel: true },
    });

    const channel =
      user.channel ??
      (await prisma.channel.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          name: channelName,
          handle: `${slug(channelName)}-${user.id.slice(-6)}`,
          description: `${channelName} shares thoughtful videos.`,
        },
      }));

    channelRecords.set(channelName, {
      userId: user.id,
      channelId: channel.id,
      name: channelName,
    });
  }

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    const channel = channelRecords.get(video.channel);
    if (!channel)
      throw new Error(`Missing seeded channel for ${video.channel}`);

    const createdAt = new Date(Date.now() - index * 6 * 60 * 60 * 1000);
    await prisma.video.upsert({
      where: { id: video.id },
      update: {
        title: video.title,
        category: video.category,
        thumbnailUrl: video.thumbnail,
        videoUrl: sampleVideoUrl(index),
        duration: SAMPLE_VIDEO_SECONDS,
        status: "READY",
        visibility: "PUBLIC",
      },
      create: {
        id: video.id,
        userId: channel.userId,
        channelId: channel.channelId,
        title: video.title,
        description: `${video.title}. A StreamBox sample video from ${channel.name}.`,
        category: video.category,
        tags: [video.category.toLocaleLowerCase(), slug(channel.name)],
        thumbnailUrl: video.thumbnail,
        videoUrl: sampleVideoUrl(index),
        duration: SAMPLE_VIDEO_SECONDS,
        status: "READY",
        visibility: "PUBLIC",
        createdAt,
      },
    });
  }

  for (let index = 0; index < shorts.length; index += 1) {
    const short = shorts[index];
    const channel = channelRecords.get(short.channel);
    if (!channel)
      throw new Error(`Missing seeded channel for ${short.channel}`);

    const details = {
      title: short.title,
      category: short.category,
      thumbnailUrl: short.thumbnail,
      videoUrl: sampleShortUrl(index),
      duration: SAMPLE_SHORT_SECONDS,
      isShort: true,
      status: "READY" as const,
      visibility: "PUBLIC" as const,
    };
    await prisma.video.upsert({
      where: { id: short.id },
      update: details,
      create: {
        ...details,
        id: short.id,
        userId: channel.userId,
        channelId: channel.channelId,
        description: `${short.title} #shorts`,
        tags: ["shorts", short.category.toLocaleLowerCase()],
        createdAt: new Date(Date.now() - index * 4 * 60 * 60 * 1000),
      },
    });
  }

  await seedActivity(Array.from(channelRecords.values()));

  console.info(
    `Seeded ${channelRecords.size} creator accounts, ${videos.length} videos, and ${shorts.length} shorts.`,
  );
  console.info(`Demo password for all seeded accounts: ${demoPassword}`);
  console.info("Example demo login: theomakes@streambox.demo");
}

/** A small deterministic random generator, so re-seeding gives the same data. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sample activity for analytics and recommendations: views over the last 90
 * days, plus subscriptions and likes between the demo accounts. Seeded views
 * use a "seed-" session id and are replaced on every run.
 */
async function seedActivity(
  channels: { userId: string; channelId: string; name: string }[],
) {
  const random = createRandom(20261124);
  const now = Date.now();
  // Biased towards recent days, with quieter weekends.
  const recentTime = () => {
    for (;;) {
      const daysAgo = Math.floor(90 * random() ** 1.6);
      const time = now - daysAgo * DAY_MS - Math.floor(random() * DAY_MS);
      const weekday = new Date(time).getUTCDay();
      if (weekday !== 0 && weekday !== 6) return new Date(time);
      if (random() < 0.6) return new Date(time);
    }
  };

  const allVideos = await prisma.video.findMany({
    where: {
      id: { in: [...videos.map((v) => v.id), ...shorts.map((v) => v.id)] },
    },
    select: { id: true, userId: true },
  });

  await prisma.view.deleteMany({
    where: { sessionId: { startsWith: "seed-" } },
  });
  const views = allVideos.flatMap((video) =>
    Array.from({ length: 15 + Math.floor(random() * 140) }, (_, i) => ({
      videoId: video.id,
      sessionId: `seed-${video.id}-${i}`,
      viewedAt: recentTime(),
    })),
  );
  await prisma.view.createMany({ data: views });

  let subscriptions = 0;
  let likes = 0;
  for (const viewer of channels) {
    const others = channels.filter(
      (channel) => channel.userId !== viewer.userId,
    );
    const follows = others.filter(() => random() < 0.2);
    const created = await prisma.subscription.createMany({
      data: follows.map((channel) => ({
        userId: viewer.userId,
        channelId: channel.channelId,
        createdAt: recentTime(),
      })),
      skipDuplicates: true,
    });
    subscriptions += created.count;

    const liked = allVideos.filter(
      (video) => video.userId !== viewer.userId && random() < 0.15,
    );
    const createdLikes = await prisma.like.createMany({
      data: liked.map((video) => ({
        userId: viewer.userId,
        videoId: video.id,
        createdAt: recentTime(),
      })),
      skipDuplicates: true,
    });
    likes += createdLikes.count;
  }

  console.info(
    `Seeded ${views.length} sample views, ${subscriptions} new subscriptions, and ${likes} new likes.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
