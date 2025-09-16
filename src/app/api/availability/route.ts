import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthorizedCalendarClientForUser } from "../../../lib/google";
import { addMinutes, startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");
  if (!sellerId) return NextResponse.json({ error: "sellerId required" }, { status: 400 });

  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const { calendar } = await getAuthorizedCalendarClientForUser(sellerId);

  const timeMin = startOfDay(new Date()).toISOString();
  const timeMax = endOfDay(new Date()).toISOString();

  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });

  const busy = fb.data.calendars?.primary?.busy || [];
  // naive slot generation: 30-min slots 9am-5pm, excluding busy
  const dayStart = new Date();
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(17, 0, 0, 0);

  const slots: { start: Date; end: Date }[] = [];
  for (let t = new Date(dayStart); t < dayEnd; t = addMinutes(t, 30)) {
    const slotStart = new Date(t);
    const slotEnd = addMinutes(slotStart, 30);
    const overlapsBusy = busy.some((b) => {
      const bStart = new Date(b.start as string);
      const bEnd = new Date(b.end as string);
      return slotStart < bEnd && slotEnd > bStart;
    });
    if (!overlapsBusy) slots.push({ start: slotStart, end: slotEnd });
  }

  return NextResponse.json(
    slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }))
  );
}


