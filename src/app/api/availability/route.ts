import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthorizedCalendarClientForUser } from "../../../lib/google";
import { generateAvailableSlots, fetchBusyPeriods } from "../../../lib/availability";
import { z } from "zod";

const querySchema = z.object({
  sellerId: z.string().min(1, "Seller ID is required"),
  days: z.string().optional().transform(val => val ? parseInt(val, 10) : 14),
  slot: z.string().optional().transform(val => val ? parseInt(val, 10) : 30),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = {
      sellerId: searchParams.get("sellerId"),
      days: searchParams.get("days"),
      slot: searchParams.get("slot"),
    };

    const { sellerId, days, slot } = querySchema.parse(params);

    // Verify seller exists and has calendar access
    const seller = await prisma.user.findUnique({ 
      where: { id: sellerId },
      select: { id: true, name: true, email: true, role: true, encryptedRefreshToken: true, calendarId: true }
    });
    
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }
    
    if (seller.role !== "SELLER") {
      return NextResponse.json({ error: "User is not a seller" }, { status: 400 });
    }
    
    if (!seller.encryptedRefreshToken) {
      return NextResponse.json({ 
        error: "Seller has not connected their Google Calendar" 
      }, { status: 400 });
    }

    // Get authorized calendar client
    const { calendar } = await getAuthorizedCalendarClientForUser(sellerId);

    // Fetch busy periods from Google Calendar
    const busyPeriods = await fetchBusyPeriods(
      calendar,
      seller.calendarId || "primary",
      days
    );

    // Generate available slots
    const availableSlots = generateAvailableSlots(busyPeriods, {
      days,
      slotDurationMinutes: slot,
      workingHours: { start: 9, end: 17 }, // TODO: Make configurable per seller
    });

    return NextResponse.json({
      slots: availableSlots,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
      },
      meta: {
        days,
        slotDuration: slot,
        totalSlots: availableSlots.length,
      },
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.issues },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes("not connected to Google Calendar")) {
        return NextResponse.json(
          { error: "Seller calendar not connected" },
          { status: 400 }
        );
      }
      
      if (error.message.includes("Failed to fetch calendar availability")) {
        return NextResponse.json(
          { error: "Unable to fetch calendar data" },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


