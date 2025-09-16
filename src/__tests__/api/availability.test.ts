import { NextRequest } from 'next/server';
import { GET } from '../../app/api/availability/route';
import { prisma } from '../../lib/prisma';
import * as googleLib from '../../lib/google';
import * as availabilityLib from '../../lib/availability';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../lib/google');
jest.mock('../../lib/availability');

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
} as any;
const mockGoogleLib = googleLib as jest.Mocked<typeof googleLib>;
const mockAvailabilityLib = availabilityLib as jest.Mocked<typeof availabilityLib>;

describe('/api/availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSeller = {
    id: 'seller-123',
    name: 'John Seller',
    email: 'seller@example.com',
    role: 'SELLER' as const,
    encryptedRefreshToken: 'encrypted-token',
    calendarId: null,
  };

  const mockCalendar = {
    freebusy: {
      query: jest.fn(),
    },
  };

  const mockTimeSlots = [
    {
      start: new Date('2024-01-15T09:00:00Z'),
      end: new Date('2024-01-15T09:30:00Z'),
      startISO: '2024-01-15T09:00:00Z',
      endISO: '2024-01-15T09:30:00Z',
      label: 'Jan 15, 2024 at 9:00 AM',
    },
    {
      start: new Date('2024-01-15T10:00:00Z'),
      end: new Date('2024-01-15T10:30:00Z'),
      startISO: '2024-01-15T10:00:00Z',
      endISO: '2024-01-15T10:30:00Z',
      label: 'Jan 15, 2024 at 10:00 AM',
    },
  ];

  it('should return availability for valid seller', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123&days=7&slot=30';
    const request = new NextRequest(url);

    mockPrisma.user.findUnique.mockResolvedValue(mockSeller);
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.generateAvailableSlots.mockReturnValue(mockTimeSlots);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.slots).toEqual(mockTimeSlots);
    expect(data.seller).toEqual({
      id: mockSeller.id,
      name: mockSeller.name,
      email: mockSeller.email,
    });
    expect(data.meta).toEqual({
      days: 7,
      slotDuration: 30,
      totalSlots: 2,
    });
  });

  it('should return 400 for missing sellerId', async () => {
    const url = 'http://localhost:3000/api/availability';
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid parameters');
  });

  it('should return 404 for non-existent seller', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=non-existent';
    const request = new NextRequest(url);

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Seller not found');
  });

  it('should return 400 for non-seller user', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=buyer-123';
    const request = new NextRequest(url);

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockSeller, role: 'BUYER' });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User is not a seller');
  });

  it('should return 400 for seller without calendar connection', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123';
    const request = new NextRequest(url);

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockSeller, encryptedRefreshToken: null });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Seller has not connected their Google Calendar');
  });

  it('should handle Google Calendar API errors', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123';
    const request = new NextRequest(url);

    mockPrisma.user.findUnique.mockResolvedValue(mockSeller);
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockRejectedValue(
      new Error('Failed to fetch calendar availability')
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Unable to fetch calendar data');
  });

  it('should use default parameters when not provided', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123';
    const request = new NextRequest(url);

    mockPrisma.user.findUnique.mockResolvedValue(mockSeller);
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.generateAvailableSlots.mockReturnValue(mockTimeSlots);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.days).toBe(14); // Default
    expect(data.meta.slotDuration).toBe(30); // Default
    
    expect(mockAvailabilityLib.generateAvailableSlots).toHaveBeenCalledWith(
      [],
      {
        days: 14,
        slotDurationMinutes: 30,
        workingHours: { start: 9, end: 17 },
      }
    );
  });

  it('should parse custom parameters correctly', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123&days=21&slot=60';
    const request = new NextRequest(url);

    mockPrisma.user.findUnique.mockResolvedValue(mockSeller);
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.generateAvailableSlots.mockReturnValue(mockTimeSlots);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.days).toBe(21);
    expect(data.meta.slotDuration).toBe(60);
    
    expect(mockAvailabilityLib.generateAvailableSlots).toHaveBeenCalledWith(
      [],
      {
        days: 21,
        slotDurationMinutes: 60,
        workingHours: { start: 9, end: 17 },
      }
    );
  });

  it('should use custom calendar ID when available', async () => {
    const url = 'http://localhost:3000/api/availability?sellerId=seller-123';
    const request = new NextRequest(url);

    const sellerWithCustomCalendar = {
      ...mockSeller,
      calendarId: 'custom-calendar-id',
    };

    mockPrisma.user.findUnique.mockResolvedValue(sellerWithCustomCalendar);
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.generateAvailableSlots.mockReturnValue(mockTimeSlots);

    await GET(request);

    expect(mockAvailabilityLib.fetchBusyPeriods).toHaveBeenCalledWith(
      mockCalendar,
      'custom-calendar-id',
      14
    );
  });
});
