import { NextRequest } from 'next/server';
import { POST } from '../../app/api/book/route';
import { getServerSession } from 'next-auth';
import { prisma } from '../../lib/prisma';
import * as googleLib from '../../lib/google';
import * as availabilityLib from '../../lib/availability';

// Mock dependencies
jest.mock('next-auth');
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
    },
  },
}));
jest.mock('../../lib/google');
jest.mock('../../lib/availability');

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  appointment: {
    create: jest.fn(),
  },
} as any;
const mockGoogleLib = googleLib as jest.Mocked<typeof googleLib>;
const mockAvailabilityLib = availabilityLib as jest.Mocked<typeof availabilityLib>;

describe('/api/book', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSession = {
    user: {
      id: 'buyer-123',
      email: 'buyer@example.com',
      name: 'John Buyer',
    },
  };

  const mockSeller = {
    id: 'seller-123',
    name: 'Jane Seller',
    email: 'seller@example.com',
    role: 'SELLER' as const,
    encryptedRefreshToken: 'encrypted-token',
    calendarId: null,
  };

  const mockBuyer = {
    id: 'buyer-123',
    name: 'John Buyer',
    email: 'buyer@example.com',
    encryptedRefreshToken: 'buyer-encrypted-token',
  };

  const mockCalendar = {
    events: {
      insert: jest.fn(),
    },
  };

  const mockBookingData = {
    sellerId: 'seller-123',
    startTimeISO: '2024-01-15T10:00:00Z',
    endTimeISO: '2024-01-15T10:30:00Z',
  };

  const mockGoogleEvent = {
    data: {
      id: 'google-event-123',
      conferenceData: {
        entryPoints: [
          {
            entryPointType: 'video',
            uri: 'https://meet.google.com/abc-def-ghi',
          },
        ],
      },
    },
  };

  const mockAppointment = {
    id: 'appointment-123',
    sellerId: 'seller-123',
    buyerId: 'buyer-123',
    start: new Date('2024-01-15T10:00:00Z'),
    end: new Date('2024-01-15T10:30:00Z'),
    googleEventId: 'google-event-123',
    summary: 'Appointment: John Buyer ↔ Jane Seller',
    description: 'Meeting between Jane Seller and John Buyer',
    location: 'https://meet.google.com/abc-def-ghi',
    seller: mockSeller,
    buyer: mockBuyer,
  };

  it('should create booking successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockSeller as any) // Seller lookup
      .mockResolvedValueOnce(mockBuyer as any); // Buyer lookup
    
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.isSlotAvailable.mockReturnValue(true);
    mockCalendar.events.insert.mockResolvedValue(mockGoogleEvent);
    mockPrisma.appointment.create.mockResolvedValue(mockAppointment as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.bookingId).toBe('appointment-123');
    expect(data.eventId).toBe('google-event-123');
    expect(data.status).toBe('confirmed');
    expect(data.joinUrl).toBe('https://meet.google.com/abc-def-ghi');
    expect(data.meta.meetLinkGenerated).toBe(true);
  });

  it('should return 401 for unauthenticated request', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
    });

    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid booking data', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify({ sellerId: 'seller-123' }), // Missing required fields
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid booking data');
    expect(data.details).toBeDefined();
  });

  it('should return 400 for past appointment time', async () => {
    const pastBookingData = {
      ...mockBookingData,
      startTimeISO: '2020-01-15T10:00:00Z',
      endTimeISO: '2020-01-15T10:30:00Z',
    };

    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(pastBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot book appointments in the past');
  });

  it('should return 400 for non-existent seller', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // Seller not found
      .mockResolvedValueOnce(mockBuyer as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid users');
  });

  it('should return 400 for seller without calendar connection', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ ...mockSeller, encryptedRefreshToken: null } as any)
      .mockResolvedValueOnce(mockBuyer as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Seller calendar not connected');
  });

  it('should return 409 for unavailable time slot', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(mockSeller as any)
      .mockResolvedValueOnce(mockBuyer as any);
    
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([
      {
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T10:30:00Z',
      },
    ]);
    mockAvailabilityLib.isSlotAvailable.mockReturnValue(false);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Time slot is no longer available');
  });

  it('should handle buyer calendar creation failure gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(mockSeller as any)
      .mockResolvedValueOnce(mockBuyer as any);
    
    mockGoogleLib.getAuthorizedCalendarClientForUser
      .mockResolvedValueOnce({ // Seller calendar - success
        calendar: mockCalendar as any,
        oauth2Client: {} as any,
      })
      .mockRejectedValueOnce(new Error('Buyer calendar error')); // Buyer calendar - failure
    
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.isSlotAvailable.mockReturnValue(true);
    mockCalendar.events.insert.mockResolvedValue(mockGoogleEvent);
    mockPrisma.appointment.create.mockResolvedValue(mockAppointment as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.meta.buyerEventCreated).toBe(false);
  });

  it('should handle Google Calendar API errors', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    mockGetServerSession.mockResolvedValue(mockSession as any);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(mockSeller as any)
      .mockResolvedValueOnce(mockBuyer as any);
    
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockRejectedValue(
      new Error('Failed to fetch calendar availability')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Unable to verify availability');
  });

  it('should create appointment without Meet link when conference data fails', async () => {
    const request = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify(mockBookingData),
      headers: { 'Content-Type': 'application/json' },
    });

    const eventWithoutMeet = {
      data: {
        id: 'google-event-123',
        conferenceData: null,
      },
    };

    mockGetServerSession.mockResolvedValue(mockSession as any);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(mockSeller as any)
      .mockResolvedValueOnce(mockBuyer as any);
    
    mockGoogleLib.getAuthorizedCalendarClientForUser.mockResolvedValue({
      calendar: mockCalendar as any,
      oauth2Client: {} as any,
    });
    
    mockAvailabilityLib.fetchBusyPeriods.mockResolvedValue([]);
    mockAvailabilityLib.isSlotAvailable.mockReturnValue(true);
    mockCalendar.events.insert.mockResolvedValue(eventWithoutMeet);
    (mockPrisma.appointment.create as jest.Mock).mockResolvedValue({
      ...mockAppointment,
      location: null,
    } as any);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.joinUrl).toBeUndefined();
    expect(data.meta.meetLinkGenerated).toBe(false);
  });
});
