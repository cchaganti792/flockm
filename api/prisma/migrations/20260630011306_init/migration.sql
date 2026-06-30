-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "media";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "topic";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "user";

-- CreateTable
CREATE TABLE "user"."accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar_url" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic"."topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic"."follows" (
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "followed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "media"."photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."photo_likes" (
    "user_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "liked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_likes_pkey" PRIMARY KEY ("user_id","photo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "user"."accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "user"."accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topic"."topics"("slug");

-- AddForeignKey
ALTER TABLE "topic"."follows" ADD CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic"."follows" ADD CONSTRAINT "follows_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topic"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."photos" ADD CONSTRAINT "photos_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topic"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."photos" ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."photo_likes" ADD CONSTRAINT "photo_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."photo_likes" ADD CONSTRAINT "photo_likes_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "media"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
