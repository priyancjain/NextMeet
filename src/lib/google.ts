import { google, calendar_v3 } from "googleapis";
import { prisma } from "./prisma";

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
  if (!user || !user.googleRefreshToken) {
    throw new Error("User is not connected to Google Calendar");
  }
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
    access_token: user.googleAccessToken ?? undefined,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  return { calendar, oauth2Client } as { calendar: calendar_v3.Calendar; oauth2Client: any };
}

export async function storeTokensForUser(params: {
  userId: string;
  refreshToken?: string | null;
  accessToken?: string | null;
  accessTokenExpires?: number | null;
}) {
  const { userId, refreshToken, accessToken, accessTokenExpires } = params;
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleRefreshToken: refreshToken ?? undefined,
      googleAccessToken: accessToken ?? undefined,
      googleAccessTokenExpires: accessTokenExpires
        ? new Date(accessTokenExpires * 1000)
        : undefined,
    },
  });
}


