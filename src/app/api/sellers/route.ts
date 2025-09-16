import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const sellers = await prisma.user.findMany({ where: { role: "SELLER" } });
  return NextResponse.json(sellers.map(({ id, name, email }) => ({ id, name, email })));
}


