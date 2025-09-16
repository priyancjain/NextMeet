import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthorizedCalendarClientForUser } from "../../../lib/google";
import { generateAvailableSlots, fetchBusyPeriods, TimeSlot } from "../../../lib/availability";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAvailability = searchParams.get("includeAvailability") === "true";
    const days = parseInt(searchParams.get("days") || "7", 10);

    // Check if database is available
    if (!prisma) {
      console.error("Database connection not available");
      return NextResponse.json([], { status: 200 });
    }

    const sellers = await prisma.user.findMany({ 
      where: { role: "SELLER" },
      select: {
        id: true,
        name: true,
        email: true,
        encryptedRefreshToken: true,
        calendarId: true,
        createdAt: true
      }
    }).catch((error) => {
      console.error("Database query failed:", error);
      return [];
    });

    if (!includeAvailability) {
      return NextResponse.json(
        sellers.map(({ id, name, email, encryptedRefreshToken }) => ({
          id,
          name,
          email,
          calendarConnected: !!encryptedRefreshToken
        }))
      );
    }

    // Include next available slots for each seller
    const sellersWithAvailability = await Promise.all(
      sellers.map(async (seller) => {
        let nextAvailableSlots: TimeSlot[] = [];
        let calendarConnected = false;

        if (seller.encryptedRefreshToken) {
          try {
            const { calendar } = await getAuthorizedCalendarClientForUser(seller.id);
            const busyPeriods = await fetchBusyPeriods(
              calendar,
              seller.calendarId || "primary",
              days
            );
            
            const availableSlots = generateAvailableSlots(busyPeriods, {
              days,
              slotDurationMinutes: 30,
              workingHours: { start: 9, end: 17 }
            });
            
            nextAvailableSlots = availableSlots.slice(0, 5); // Show next 5 slots
            calendarConnected = true;
          } catch (error) {
            console.warn(`Failed to fetch availability for seller ${seller.id}:`, error);
          }
        }

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          calendarConnected,
          nextAvailableSlots,
          timezone: "UTC" // TODO: Make configurable
        };
      })
    );

    return NextResponse.json(sellersWithAvailability);
  } catch (error) {
    console.error("Error fetching sellers:", error);
    // Return empty array instead of error object to prevent frontend crashes
    return NextResponse.json([]);
  }
}


