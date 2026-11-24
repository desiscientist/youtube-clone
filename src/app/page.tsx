import { redirect } from "next/navigation";
import { HomeFeed } from "@/components/home-feed";
import { prisma } from "@/lib/prisma";
import { recommendVideos } from "@/lib/recommendations";
import { getCurrentUserId } from "@/lib/session";
import {
  VIDEO_CATEGORIES,
  shortsWhere,
  toVideoCard,
  videoCardInclude,
} from "@/lib/videos";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: { q?: string; category?: string };
};

export default async function Home({ searchParams }: HomeProps) {
  // Older links searched on the home page; searches now have their own page.
  if (searchParams.q) {
    redirect(`/results?q=${encodeURIComponent(searchParams.q)}`);
  }

  const category = (VIDEO_CATEGORIES as readonly string[]).includes(
    searchParams.category ?? "",
  )
    ? searchParams.category
    : undefined;
  const userId = await getCurrentUserId();
  const [firstPage, shorts] = await Promise.all([
    recommendVideos({ userId, category }),
    prisma.video.findMany({
      where: shortsWhere,
      include: videoCardInclude,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <HomeFeed
      category={category}
      firstPage={firstPage}
      // A fresh feed (and scroll position) for each category.
      key={category ?? "all"}
      shorts={shorts.map(toVideoCard)}
    />
  );
}
