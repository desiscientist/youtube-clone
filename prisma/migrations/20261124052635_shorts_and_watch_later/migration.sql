-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN     "isWatchLater" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "isShort" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Playlist_userId_isWatchLater_idx" ON "Playlist"("userId", "isWatchLater");

-- CreateIndex
CREATE INDEX "Video_isShort_createdAt_idx" ON "Video"("isShort", "createdAt");
