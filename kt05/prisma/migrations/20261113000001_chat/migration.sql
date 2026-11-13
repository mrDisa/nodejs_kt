-- Persist public and room messages with an authenticated author.
CREATE TABLE "ChatMessage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "content" TEXT NOT NULL,
  "room" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL,
  CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");
CREATE INDEX "ChatMessage_room_createdAt_idx" ON "ChatMessage"("room", "createdAt");
