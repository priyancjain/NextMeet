"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Seller {
  id: string;
  name: string;
  email: string;
  calendarConnected: boolean;
  nextAvailableSlots?: Array<{
    start: Date;
    end: Date;
    startISO: string;
    endISO: string;
    label: string;
  }>;
}

interface TimeSlot {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  label: string;
}

export default function BuyerPage() {
  const { data: session, status } = useSession();
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const { data: sellers, error: sellersError } = useSWR<Seller[]>(
    "/api/sellers?includeAvailability=true", 
    fetcher
  );
  
  const { data: availabilityData, error: slotsError, mutate: mutateSlots } = useSWR(
    selectedSellerId ? `/api/availability?sellerId=${selectedSellerId}&days=14&slot=30` : null,
    fetcher
  );

  const selectedSeller = sellers?.find(s => s.id === selectedSellerId);
  const slots = availabilityData?.slots || [];

  async function book(slot: TimeSlot) {
    if (!session) {
      setBookingMessage({ type: 'error', text: 'Please sign in to book appointments' });
      return;
    }

    setIsBooking(true);
    setBookingMessage(null);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sellerId: selectedSellerId, 
          startTimeISO: slot.startISO, 
          endTimeISO: slot.endISO 
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Booking failed');
      }
      
      setBookingMessage({ 
        type: 'success', 
        text: `Appointment booked successfully! ${data.joinUrl ? 'Google Meet link will be sent via email.' : ''}` 
      });
      
      // Refresh availability data
      mutateSlots();
      
    } catch (error) {
      console.error('Booking error:', error);
      setBookingMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to book appointment' 
      });
    } finally {
      setIsBooking(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Book an Appointment</h1>
        <div className="flex gap-3">
          <Link 
            href="/appointments" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            My Appointments
          </Link>
          {session ? (
            <Link 
              href="/api/auth/signout" 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Sign Out
            </Link>
          ) : (
            <Link 
              href="/api/auth/signin" 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {!session && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Sign in required</h3>
              <p className="mt-1 text-sm text-yellow-700">
                You need to sign in with Google to book appointments. This allows us to add the appointment to your calendar.
              </p>
            </div>
          </div>
        </div>
      )}

      {bookingMessage && (
        <div className={`rounded-lg p-4 ${
          bookingMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="font-medium">{bookingMessage.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sellers List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Available Sellers</h2>
          
          {sellersError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Failed to load sellers. Please refresh the page.</p>
            </div>
          )}
          
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {!sellers ? (
              <div className="animate-pulse p-4 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : sellers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No sellers available at the moment.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {sellers.map((seller) => (
                  <li key={seller.id}>
                    <button
                      className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${
                        selectedSellerId === seller.id ? "bg-blue-50 border-r-4 border-blue-500" : ""
                      }`}
                      onClick={() => setSelectedSellerId(seller.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {seller.name || seller.email}
                          </h3>
                          <p className="text-sm text-gray-600">{seller.email}</p>
                          <div className="flex items-center mt-2">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              seller.calendarConnected ? "bg-green-500" : "bg-red-500"
                            }`}></div>
                            <span className={`text-xs ${
                              seller.calendarConnected ? "text-green-700" : "text-red-700"
                            }`}>
                              {seller.calendarConnected ? "Available" : "Calendar not connected"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          {seller.nextAvailableSlots && seller.nextAvailableSlots.length > 0 && (
                            <p className="text-xs text-gray-500">
                              Next: {new Date(seller.nextAvailableSlots[0].startISO).toLocaleDateString()}
                            </p>
                          )}
                          <span className="text-sm text-blue-600">Select →</span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Available Slots */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Available Time Slots
            {selectedSeller && (
              <span className="text-base font-normal text-gray-600 ml-2">
                for {selectedSeller.name || selectedSeller.email}
              </span>
            )}
          </h2>
          
          {!selectedSellerId ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">Select a seller to view their available time slots.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              {slotsError ? (
                <div className="p-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">Failed to load availability. Please try again.</p>
                  </div>
                </div>
              ) : !availabilityData ? (
                <div className="p-6">
                  <div className="animate-pulse space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ) : slots.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No available slots in the next 14 days.</p>
                  <p className="text-sm mt-2">Please check back later or contact the seller directly.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <ul className="divide-y divide-gray-200">
                    {slots.map((slot: TimeSlot) => (
                      <li key={slot.startISO} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{slot.label}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(slot.startISO).toLocaleTimeString()} - {new Date(slot.endISO).toLocaleTimeString()}
                            </p>
                          </div>
                          <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => book(slot)}
                            disabled={isBooking || !session}
                          >
                            {isBooking ? "Booking..." : "Book"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


