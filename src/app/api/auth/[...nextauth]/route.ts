import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../../lib/prisma";
import { storeTokensForUser } from "../../../../lib/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  debug: process.env.NODE_ENV !== "production",
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        token.userId = user.id as string;
        token.refreshToken = account.refresh_token;
        token.accessToken = account.access_token;
        
        // Store user in database if not exists
        try {
          await prisma.user.upsert({
            where: { email: user.email! },
            update: {
              name: user.name,
              image: user.image,
            },
            create: {
              id: user.id!,
              email: user.email!,
              name: user.name,
              image: user.image,
              role: 'SELLER', // Default role - allows access to dashboard
            },
          });

          // Store tokens for Calendar API usage
          if (account.refresh_token) {
            await storeTokensForUser({
              userId: user.id!,
              refreshToken: account.refresh_token,
              accessToken: account.access_token,
              accessTokenExpires: account.expires_at ?? null,
            });
          }
        } catch (err) {
          console.error("[NextAuth JWT error]", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };


