import { addDays, addMinutes, format, isAfter, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';
import { calendar_v3 } from 'googleapis';

export interface TimeSlot {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  label: string;
}

export interface WorkingHours {
  start: number; // hour (0-23)
  end: number;   // hour (0-23)
}

export interface AvailabilityOptions {
  days?: number;
  slotDurationMinutes?: number;
  workingHours?: WorkingHours;
  timezone?: string;
}

const DEFAULT_OPTIONS: Required<AvailabilityOptions> = {
  days: 14,
  slotDurationMinutes: 30,
  workingHours: { start: 9, end: 17 },
  timezone: 'UTC'
};

/**
 * Generate available time slots for a given date range, excluding busy periods
 */
export function generateAvailableSlots(
  busyPeriods: Array<{ start: string; end: string }>,
  options: AvailabilityOptions = {}
): TimeSlot[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < opts.days; dayOffset++) {
    const currentDate = addDays(startOfDay(now), dayOffset);
    
    // Skip weekends (optional - could be configurable)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dayStart = setMinutes(setHours(currentDate, opts.workingHours.start), 0);
    const dayEnd = setMinutes(setHours(currentDate, opts.workingHours.end), 0);

    // Generate slots for this day
    let slotStart = new Date(dayStart);
    
    while (isBefore(slotStart, dayEnd)) {
      const slotEnd = addMinutes(slotStart, opts.slotDurationMinutes);
      
      // Skip if slot end goes beyond working hours
      if (isAfter(slotEnd, dayEnd)) break;
      
      // Skip if slot is in the past
      if (isBefore(slotEnd, now)) {
        slotStart = addMinutes(slotStart, opts.slotDurationMinutes);
        continue;
      }

      // Check if slot overlaps with any busy period
      const overlapsWithBusy = busyPeriods.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      if (!overlapsWithBusy) {
        slots.push({
          start: new Date(slotStart),
          end: new Date(slotEnd),
          startISO: slotStart.toISOString(),
          endISO: slotEnd.toISOString(),
          label: `${format(slotStart, 'MMM d, yyyy')} at ${format(slotStart, 'h:mm a')}`
        });
      }

      slotStart = addMinutes(slotStart, opts.slotDurationMinutes);
    }
  }

  return slots;
}

/**
 * Fetch busy periods from Google Calendar using FreeBusy API
 */
export async function fetchBusyPeriods(
  calendar: calendar_v3.Calendar,
  calendarId: string = 'primary',
  days: number = 14
): Promise<Array<{ start: string; end: string }>> {
  const timeMin = new Date().toISOString();
  const timeMax = addDays(new Date(), days).toISOString();

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      },
    });

    const busyPeriods = response.data.calendars?.[calendarId]?.busy || [];
    return busyPeriods.map(period => ({
      start: period.start as string,
      end: period.end as string,
    }));
  } catch (error) {
    console.error('Error fetching busy periods:', error);
    throw new Error('Failed to fetch calendar availability');
  }
}

/**
 * Validate that a time slot is available
 */
export function isSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  busyPeriods: Array<{ start: string; end: string }>
): boolean {
  const now = new Date();
  
  // Slot must be in the future
  if (isBefore(slotStart, now)) return false;
  
  // Check against busy periods
  return !busyPeriods.some(busy => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}
