import { generateAvailableSlots, isSlotAvailable } from '../../lib/availability';
import { addDays, addHours, setHours, setMinutes } from 'date-fns';

describe('Availability Functions', () => {
  const mockNow = new Date('2024-01-15T10:00:00.000Z'); // Monday
  
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('generateAvailableSlots', () => {
    it('should generate slots for business hours', () => {
      const busyPeriods: Array<{ start: string; end: string }> = [];
      const slots = generateAvailableSlots(busyPeriods, {
        days: 1,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 }
      });

      expect(slots.length).toBeGreaterThan(0);
      
      // Check first slot starts at 9 AM
      const firstSlot = slots[0];
      expect(new Date(firstSlot.startISO).getHours()).toBe(9);
      expect(new Date(firstSlot.startISO).getMinutes()).toBe(0);
      
      // Check slot duration
      const duration = new Date(firstSlot.endISO).getTime() - new Date(firstSlot.startISO).getTime();
      expect(duration).toBe(30 * 60 * 1000); // 30 minutes in milliseconds
    });

    it('should exclude busy periods', () => {
      const busyPeriods = [
        {
          start: setHours(setMinutes(addDays(mockNow, 0), 0), 10).toISOString(), // 10:00 AM
          end: setHours(setMinutes(addDays(mockNow, 0), 30), 10).toISOString()   // 10:30 AM
        }
      ];

      const slots = generateAvailableSlots(busyPeriods, {
        days: 1,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 }
      });

      // Check that no slot overlaps with the busy period
      const overlappingSlots = slots.filter(slot => {
        const slotStart = new Date(slot.startISO);
        const slotEnd = new Date(slot.endISO);
        const busyStart = new Date(busyPeriods[0].start);
        const busyEnd = new Date(busyPeriods[0].end);
        
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      expect(overlappingSlots).toHaveLength(0);
    });

    it('should skip past time slots', () => {
      // Set current time to 2 PM
      const currentTime = setHours(setMinutes(mockNow, 0), 14);
      jest.setSystemTime(currentTime);

      const slots = generateAvailableSlots([], {
        days: 1,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 }
      });

      // All slots should be in the future
      slots.forEach(slot => {
        expect(new Date(slot.startISO).getTime()).toBeGreaterThan(currentTime.getTime());
      });
    });

    it('should skip weekends', () => {
      // Set to Saturday
      const saturday = new Date('2024-01-13T10:00:00.000Z');
      jest.setSystemTime(saturday);

      const slots = generateAvailableSlots([], {
        days: 7,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 }
      });

      // Check that no slots are on Saturday (day 6) or Sunday (day 0)
      slots.forEach(slot => {
        const dayOfWeek = new Date(slot.startISO).getDay();
        expect(dayOfWeek).not.toBe(0); // Sunday
        expect(dayOfWeek).not.toBe(6); // Saturday
      });
    });

    it('should respect custom slot duration', () => {
      const slots = generateAvailableSlots([], {
        days: 1,
        slotDurationMinutes: 60,
        workingHours: { start: 9, end: 17 }
      });

      slots.forEach(slot => {
        const duration = new Date(slot.endISO).getTime() - new Date(slot.startISO).getTime();
        expect(duration).toBe(60 * 60 * 1000); // 60 minutes
      });
    });

    it('should respect custom working hours', () => {
      const slots = generateAvailableSlots([], {
        days: 1,
        slotDurationMinutes: 30,
        workingHours: { start: 10, end: 16 }
      });

      if (slots.length > 0) {
        const firstSlot = slots[0];
        const lastSlot = slots[slots.length - 1];
        
        expect(new Date(firstSlot.startISO).getHours()).toBeGreaterThanOrEqual(10);
        expect(new Date(lastSlot.endISO).getHours()).toBeLessThanOrEqual(16);
      }
    });

    it('should generate slots for multiple days', () => {
      const slots = generateAvailableSlots([], {
        days: 3,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 }
      });

      // Should have slots spanning multiple days
      const uniqueDays = new Set(
        slots.map(slot => new Date(slot.startISO).toDateString())
      );
      
      expect(uniqueDays.size).toBeGreaterThan(1);
    });

    it('should include proper labels', () => {
      const slots = generateAvailableSlots([], {
        days: 1,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 10 } // Short window for testing
      });

      if (slots.length > 0) {
        const slot = slots[0];
        expect(slot.label).toContain('Jan');
        expect(slot.label).toContain('2024');
        expect(slot.label).toContain('at');
      }
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true for available slot', () => {
      const slotStart = addHours(mockNow, 2);
      const slotEnd = addHours(mockNow, 2.5);
      const busyPeriods: Array<{ start: string; end: string }> = [];

      const isAvailable = isSlotAvailable(slotStart, slotEnd, busyPeriods);
      expect(isAvailable).toBe(true);
    });

    it('should return false for past slot', () => {
      const slotStart = addHours(mockNow, -2);
      const slotEnd = addHours(mockNow, -1.5);
      const busyPeriods: Array<{ start: string; end: string }> = [];

      const isAvailable = isSlotAvailable(slotStart, slotEnd, busyPeriods);
      expect(isAvailable).toBe(false);
    });

    it('should return false for overlapping busy period', () => {
      const slotStart = addHours(mockNow, 2);
      const slotEnd = addHours(mockNow, 2.5);
      const busyPeriods = [
        {
          start: addHours(mockNow, 1.5).toISOString(),
          end: addHours(mockNow, 2.25).toISOString()
        }
      ];

      const isAvailable = isSlotAvailable(slotStart, slotEnd, busyPeriods);
      expect(isAvailable).toBe(false);
    });

    it('should return true for adjacent busy periods', () => {
      const slotStart = addHours(mockNow, 2);
      const slotEnd = addHours(mockNow, 2.5);
      const busyPeriods = [
        {
          start: addHours(mockNow, 1).toISOString(),
          end: addHours(mockNow, 2).toISOString() // Ends exactly when slot starts
        },
        {
          start: addHours(mockNow, 2.5).toISOString(), // Starts exactly when slot ends
          end: addHours(mockNow, 3).toISOString()
        }
      ];

      const isAvailable = isSlotAvailable(slotStart, slotEnd, busyPeriods);
      expect(isAvailable).toBe(true);
    });

    it('should handle multiple busy periods', () => {
      const slotStart = addHours(mockNow, 2);
      const slotEnd = addHours(mockNow, 2.5);
      const busyPeriods = [
        {
          start: addHours(mockNow, 1).toISOString(),
          end: addHours(mockNow, 1.5).toISOString()
        },
        {
          start: addHours(mockNow, 3).toISOString(),
          end: addHours(mockNow, 3.5).toISOString()
        }
      ];

      const isAvailable = isSlotAvailable(slotStart, slotEnd, busyPeriods);
      expect(isAvailable).toBe(true);
    });
  });
});
