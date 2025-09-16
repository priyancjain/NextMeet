/*
  Warnings:

  - You are about to drop the column `googleRefreshToken` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "encryptedRefreshToken" TEXT,
    "googleAccessToken" TEXT,
    "googleAccessTokenExpires" DATETIME,
    "calendarId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "googleAccessToken", "googleAccessTokenExpires", "id", "image", "name", "role", "updatedAt") SELECT "createdAt", "email", "emailVerified", "googleAccessToken", "googleAccessTokenExpires", "id", "image", "name", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
