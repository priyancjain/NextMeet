import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { getAuthorizedCalendarClientForUser } from "../../../lib/google";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchBusyPeriods, isSlotAvailable } from "../../../lib/availability";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const bookingSchema = z.object({
  sellerId: z.string().min(1, "Seller ID is required"),
  startTimeISO: z.string().datetime("Invalid start time format"),
  endTimeISO: z.string().datetime("Invalid end time format"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const buyerId = (session.user as any).id as string;

    const body = await req.json();
    const { sellerId, startTimeISO, endTimeISO } = bookingSchema.parse(body);

    const startTime = new Date(startTimeISO);
    const endTime = new Date(endTimeISO);

    // Validate time slot is in the future
    if (startTime <= new Date()) {
      return NextResponse.json(
        { error: "Cannot book appointments in the past" },
        { status: 400 }
      );
    }

    // Ensure both parties exist
    const [seller, buyer] = await Promise.all([
      prisma.user.findUnique({ 
        where: { id: sellerId },
        select: { id: true, name: true, email: true, role: true, encryptedRefreshToken: true, calendarId: true }
      }),
      prisma.user.findUnique({ 
        where: { id: buyerId },
        select: { id: true, name: true, email: true, encryptedRefreshToken: true }
      }),
    ]);

    if (!seller || !buyer) {
      return NextResponse.json({ error: "Invalid users" }, { status: 400 });
    }

    if (seller.role !== "SELLER") {
      return NextResponse.json({ error: "Invalid seller" }, { status: 400 });
    }

    if (!seller.encryptedRefreshToken) {
      return NextResponse.json(
        { error: "Seller calendar not connected" },
        { status: 400 }
      );
    }

    // Re-check availability to prevent double booking
    const { calendar: sellerCalendar } = await getAuthorizedCalendarClientForUser(sellerId);
    const busyPeriods = await fetchBusyPeriods(
      sellerCalendar,
      seller.calendarId || "primary",
      1 // Just check today
    );

    if (!isSlotAvailable(startTime, endTime, busyPeriods)) {
      return NextResponse.json(
        { error: "Time slot is no longer available" },
        { status: 409 }
      );
    }

    // Generate unique conference request ID for Google Meet
    const conferenceRequestId = uuidv4();

    // Create event on seller's calendar with Google Meet link
    const eventRes = await sellerCalendar.events.insert({
      calendarId: seller.calendarId || "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Appointment: ${buyer.name || buyer.email} ↔ ${seller.name || seller.email}`,
        description: `Meeting between ${seller.name || seller.email} and ${buyer.name || buyer.email}`,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        attendees: [
          { email: seller.email!, responseStatus: "accepted" },
          { email: buyer.email!, responseStatus: "needsAction" },
        ],
        conferenceData: {
          createRequest: {
            requestId: conferenceRequestId,
            conferenceSolutionKey: {
              type: "hangoutsMeet"
            }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 30 }, // 30 minutes before
          ],
        },
      },
      sendUpdates: "all",
    });

    const googleEventId = eventRes.data.id!;
    const meetLink = eventRes.data.conferenceData?.entryPoints?.find(
      ep => ep.entryPointType === "video"
    )?.uri;

    // Try to add to buyer's calendar if they have granted calendar scope
    let buyerEventCreated = false;
    try {
      if (buyer.encryptedRefreshToken) {
        const { calendar: buyerCalendar } = await getAuthorizedCalendarClientForUser(buyerId);
        await buyerCalendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: `Appointment with ${seller.name || seller.email}`,
            description: `Meeting with ${seller.name || seller.email}${meetLink ? `\n\nJoin: ${meetLink}` : ''}`,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            attendees: [
              { email: seller.email!, responseStatus: "needsAction" },
              { email: buyer.email!, responseStatus: "accepted" },
            ],
            reminders: {
              useDefault: false,
              overrides: [
                { method: "email", minutes: 24 * 60 },
                { method: "popup", minutes: 30 },
              ],
            },
          },
          sendUpdates: "all",
        });
        buyerEventCreated = true;
      }
    } catch (error) {
      console.warn("Could not create event on buyer's calendar:", error);
      // Continue - this is not a critical failure
    }

    // Store booking in database
    const appointment = await prisma.appointment.create({
      data: {
        sellerId,
        buyerId,
        start: startTime,
        end: endTime,
        googleEventId,
        summary: `Appointment: ${buyer.name || buyer.email} ↔ ${seller.name || seller.email}`,
        description: `Meeting between ${seller.name || seller.email} and ${buyer.name || buyer.email}`,
        location: meetLink || undefined,
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        buyer: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      bookingId: appointment.id,
      eventId: googleEventId,
      status: "confirmed",
      joinUrl: meetLink,
      appointment,
      meta: {
        buyerEventCreated,
        meetLinkGenerated: !!meetLink,
      }
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating booking:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid booking data", details: error.issues },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes("not connected to Google Calendar")) {
        return NextResponse.json(
          { error: "Calendar access required" },
          { status: 400 }
        );
      }
      
      if (error.message.includes("Failed to fetch calendar availability")) {
        return NextResponse.json(
          { error: "Unable to verify availability" },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}


