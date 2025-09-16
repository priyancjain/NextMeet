import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { getAuthorizedCalendarClientForUser } from "../../../lib/google";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const buyerId = (session.user as any).id as string;

  const { sellerId, start, end } = await req.json();
  if (!sellerId || !start || !end) {
    return NextResponse.json({ error: "sellerId, start, end required" }, { status: 400 });
  }

  // Ensure both parties exist
  const [seller, buyer] = await Promise.all([
    prisma.user.findUnique({ where: { id: sellerId } }),
    prisma.user.findUnique({ where: { id: buyerId } }),
  ]);
  if (!seller || !buyer) return NextResponse.json({ error: "Invalid users" }, { status: 400 });

  // Create the event on seller's calendar first
  const { calendar: sellerCalendar } = await getAuthorizedCalendarClientForUser(sellerId);

  const eventRes = await sellerCalendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `Appointment: ${buyer.name || buyer.email} ↔ ${seller.name || seller.email}`,
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
      attendees: [
        { email: seller.email || undefined },
        { email: buyer.email || undefined },
      ].filter(Boolean) as any,
      conferenceData: {
        createRequest: { requestId: `meet-${Date.now()}` },
      },
    },
    conferenceDataVersion: 1,
    sendUpdates: "all",
  });

  const googleEventId = eventRes.data.id as string;

  // Try to add to buyer's calendar if refresh token exists
  try {
    const { calendar: buyerCalendar } = await getAuthorizedCalendarClientForUser(buyerId);
    await buyerCalendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Appointment with ${seller.name || seller.email}`,
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
        attendees: [
          { email: seller.email || undefined },
          { email: buyer.email || undefined },
        ].filter(Boolean) as any,
      },
      sendUpdates: "all",
    });
  } catch (_) {
    // Buyer may not have granted calendar scope; ignore
  }

  const appt = await prisma.appointment.create({
    data: {
      sellerId,
      buyerId,
      start: new Date(start),
      end: new Date(end),
      googleEventId,
      summary: `Appointment`,
    },
  });

  return NextResponse.json(appt);
}


