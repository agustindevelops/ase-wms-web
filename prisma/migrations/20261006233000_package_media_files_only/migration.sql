-- Package media is always an uploaded image or video file.
ALTER TABLE "PackageFile" DROP CONSTRAINT IF EXISTS "PackageFile_media_check";

-- AlterTable
ALTER TABLE "PackageFile" DROP COLUMN "videoUrl",
ALTER COLUMN "fileId" SET NOT NULL;
