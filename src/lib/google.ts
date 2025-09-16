import { google, calendar_v3 } from "googleapis";
import { prisma } from "./prisma";
import { encryptToken, decryptToken } from "./encryption";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export async function getAuthorizedCalendarClientForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.encryptedRefreshToken) {
    throw new Error("User is not connected to Google Calendar");
  }
  
  const refreshToken = decryptToken(user.encryptedRefreshToken);
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: user.googleAccessToken ?? undefined,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  return { calendar, oauth2Client } as { calendar: calendar_v3.Calendar; oauth2Client: InstanceType<typeof google.auth.OAuth2> };
}

export async function storeTokensForUser(params: {
  userId: string;
  refreshToken?: string | null;
  accessToken?: string | null;
  accessTokenExpires?: number | null;
}) {
  const { userId, refreshToken, accessToken, accessTokenExpires } = params;
  
  const updateData: Record<string, unknown> = {
    googleAccessToken: accessToken ?? undefined,
    googleAccessTokenExpires: accessTokenExpires
      ? new Date(accessTokenExpires * 1000)
      : undefined,
  };
  
  if (refreshToken) {
    updateData.encryptedRefreshToken = encryptToken(refreshToken);
  }
  
  await prisma.user.upsert({
    where: { id: userId },
    update: updateData,
    create: {
      id: userId,
      email: '', // Will be updated by NextAuth
      role: 'BUYER',
      ...updateData,
    },
  });
}


