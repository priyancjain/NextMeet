import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = (session.user as any).id as string;
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "both";

    // Get user to determine their role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let appointments;

    if (role === "seller" || (role === "both" && user.role === "SELLER")) {
      // Get appointments where user is the seller
      appointments = await prisma.appointment.findMany({
        where: { sellerId: userId },
        include: {
          buyer: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { start: "asc" }
      });
    } else if (role === "buyer" || (role === "both" && user.role === "BUYER")) {
      // Get appointments where user is the buyer
      appointments = await prisma.appointment.findMany({
        where: { buyerId: userId },
        include: {
          seller: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { start: "asc" }
      });
    } else {
      // Get all appointments for this user (both as seller and buyer)
      const [sellerAppointments, buyerAppointments] = await Promise.all([
        prisma.appointment.findMany({
          where: { sellerId: userId },
          include: {
            buyer: {
              select: { id: true, name: true, email: true }
            }
          }
        }),
        prisma.appointment.findMany({
          where: { buyerId: userId },
          include: {
            seller: {
              select: { id: true, name: true, email: true }
            }
          }
        })
      ]);

      appointments = [
        ...sellerAppointments.map(apt => ({ ...apt, userRole: "seller" as const })),
        ...buyerAppointments.map(apt => ({ ...apt, userRole: "buyer" as const }))
      ].sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    // Separate upcoming and past appointments
    const now = new Date();
    const upcoming = appointments.filter(apt => apt.start > now);
    const past = appointments.filter(apt => apt.start <= now);

    return NextResponse.json({
      appointments: {
        upcoming,
        past,
        total: appointments.length
      },
      meta: {
        userId,
        userRole: user.role,
        requestedRole: role
      }
    });

  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}
