import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const checks = {
      database: false,
      environment: {
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        DATABASE_URL: !!process.env.DATABASE_URL,
        TOKEN_ENCRYPTION_KEY: !!process.env.TOKEN_ENCRYPTION_KEY,
      }
    };

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      console.error("Database check failed:", error);
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: "Health check failed",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
