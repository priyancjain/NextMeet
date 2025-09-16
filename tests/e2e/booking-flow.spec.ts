import { test, expect } from '@playwright/test';

// Mock data for testing
const mockSeller = {
  id: 'test-seller-123',
  name: 'Test Seller',
  email: 'seller@test.com',
  calendarConnected: true,
  nextAvailableSlots: [
    {
      startISO: '2024-01-15T10:00:00Z',
      endISO: '2024-01-15T10:30:00Z',
      label: 'Jan 15, 2024 at 10:00 AM'
    }
  ]
};

const mockAvailabilityResponse = {
  slots: [
    {
      startISO: '2024-01-15T10:00:00Z',
      endISO: '2024-01-15T10:30:00Z',
      label: 'Jan 15, 2024 at 10:00 AM'
    },
    {
      startISO: '2024-01-15T11:00:00Z',
      endISO: '2024-01-15T11:30:00Z',
      label: 'Jan 15, 2024 at 11:00 AM'
    }
  ],
  seller: mockSeller,
  meta: {
    days: 14,
    slotDuration: 30,
    totalSlots: 2
  }
};

const mockBookingResponse = {
  bookingId: 'booking-123',
  eventId: 'google-event-123',
  status: 'confirmed',
  joinUrl: 'https://meet.google.com/abc-def-ghi',
  appointment: {
    id: 'booking-123',
    start: '2024-01-15T10:00:00Z',
    end: '2024-01-15T10:30:00Z',
    summary: 'Appointment: Test Buyer ↔ Test Seller'
  },
  meta: {
    buyerEventCreated: true,
    meetLinkGenerated: true
  }
};

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('/api/sellers*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockSeller])
      });
    });

    await page.route('/api/availability*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAvailabilityResponse)
      });
    });

    await page.route('/api/book', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockBookingResponse)
        });
      }
    });

    // Mock NextAuth session
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-buyer-123',
            name: 'Test Buyer',
            email: 'buyer@test.com'
          }
        })
      });
    });
  });

  test('should complete full booking flow', async ({ page }) => {
    // Navigate to buyer page
    await page.goto('/buyer');

    // Wait for sellers to load
    await expect(page.locator('h2:has-text("Available Sellers")')).toBeVisible();
    
    // Check that seller is displayed
    await expect(page.locator('text=Test Seller')).toBeVisible();
    await expect(page.locator('text=seller@test.com')).toBeVisible();
    await expect(page.locator('text=Available')).toBeVisible();

    // Select the seller
    await page.click('button:has-text("Test Seller")');
    
    // Wait for availability to load
    await expect(page.locator('h2:has-text("Available Time Slots")')).toBeVisible();
    
    // Check that time slots are displayed
    await expect(page.locator('text=Jan 15, 2024 at 10:00 AM')).toBeVisible();
    await expect(page.locator('text=Jan 15, 2024 at 11:00 AM')).toBeVisible();

    // Book the first available slot
    await page.locator('button:has-text("Book")').first().click();

    // Check for success message
    await expect(page.locator('text=Appointment booked successfully!')).toBeVisible();
    await expect(page.locator('text=Google Meet link will be sent via email')).toBeVisible();
  });

  test('should show sign-in prompt for unauthenticated users', async ({ page }) => {
    // Mock unauthenticated session
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await page.goto('/buyer');

    // Check for sign-in warning
    await expect(page.locator('text=Sign in required')).toBeVisible();
    await expect(page.locator('text=You need to sign in with Google')).toBeVisible();
    
    // Check that sign-in button is present
    await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
  });

  test('should handle seller selection and availability loading', async ({ page }) => {
    await page.goto('/buyer');

    // Initially, no seller should be selected
    await expect(page.locator('text=Select a seller to view their available time slots')).toBeVisible();

    // Select seller
    await page.click('button:has-text("Test Seller")');

    // Check that seller is highlighted
    await expect(page.locator('button:has-text("Test Seller")').first()).toHaveClass(/bg-blue-50/);

    // Check availability section updates
    await expect(page.locator('text=Available Time Slots for Test Seller')).toBeVisible();
  });

  test('should handle booking errors gracefully', async ({ page }) => {
    // Mock booking error
    await page.route('/api/book', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Time slot is no longer available'
          })
        });
      }
    });

    await page.goto('/buyer');
    
    // Select seller and slot
    await page.click('button:has-text("Test Seller")');
    await page.locator('button:has-text("Book")').first().click();

    // Check for error message
    await expect(page.locator('text=Time slot is no longer available')).toBeVisible();
  });

  test('should show loading states during booking', async ({ page }) => {
    // Add delay to booking response
    await page.route('/api/book', async route => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockBookingResponse)
        });
      }
    });

    await page.goto('/buyer');
    
    // Select seller and initiate booking
    await page.click('button:has-text("Test Seller")');
    await page.locator('button:has-text("Book")').first().click();

    // Check for loading state
    await expect(page.locator('button:has-text("Booking...")')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Appointment booked successfully!')).toBeVisible();
  });

  test('should handle empty seller list', async ({ page }) => {
    // Mock empty sellers response
    await page.route('/api/sellers*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/buyer');

    // Check for empty state message
    await expect(page.locator('text=No sellers available at the moment')).toBeVisible();
  });

  test('should handle seller with no available slots', async ({ page }) => {
    // Mock empty availability response
    await page.route('/api/availability*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slots: [],
          seller: mockSeller,
          meta: { days: 14, slotDuration: 30, totalSlots: 0 }
        })
      });
    });

    await page.goto('/buyer');
    
    // Select seller
    await page.click('button:has-text("Test Seller")');

    // Check for no slots message
    await expect(page.locator('text=No available slots in the next 14 days')).toBeVisible();
    await expect(page.locator('text=Please check back later')).toBeVisible();
  });

  test('should navigate to appointments page after booking', async ({ page }) => {
    await page.goto('/buyer');
    
    // Complete booking flow
    await page.click('button:has-text("Test Seller")');
    await page.click('button:has-text("Book")').first();
    
    // Wait for success message
    await expect(page.locator('text=Appointment booked successfully!')).toBeVisible();
    
    // Click on "My Appointments" link
    await page.click('a:has-text("My Appointments")');
    
    // Should navigate to appointments page
    await expect(page.url()).toContain('/appointments');
  });

  test('should show seller calendar connection status', async ({ page }) => {
    // Mock seller without calendar connection
    const disconnectedSeller = {
      ...mockSeller,
      calendarConnected: false
    };

    await page.route('/api/sellers*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([disconnectedSeller])
      });
    });

    await page.goto('/buyer');

    // Check for disconnected status
    await expect(page.locator('text=Calendar not connected')).toBeVisible();
    
    // Status indicator should be red
    await expect(page.locator('.bg-red-500')).toBeVisible();
  });
});
