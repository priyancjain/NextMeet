"use client";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BuyerPage() {
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const { data: sellers } = useSWR("/api/sellers", fetcher);
  const { data: slots } = useSWR(
    selectedSellerId ? `/api/availability?sellerId=${selectedSellerId}` : null,
    fetcher
  );

  async function book(slot: { start: string; end: string }) {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId: selectedSellerId, start: slot.start, end: slot.end }),
    });
    if (!res.ok) alert("Booking failed");
    else alert("Booked!");
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Set Appointment</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-medium mb-2">Sellers</h2>
          <ul className="space-y-1">
            {(sellers ?? []).map((s: any) => (
              <li key={s.id}>
                <button
                  className={`text-left w-full px-3 py-2 rounded ${
                    selectedSellerId === s.id ? "bg-black text-white" : "bg-gray-100"
                  }`}
                  onClick={() => setSelectedSellerId(s.id)}
                >
                  {s.name || s.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-medium mb-2">Available slots</h2>
          {!selectedSellerId ? (
            <p className="text-sm text-gray-600">Pick a seller to view availability.</p>
          ) : (
            <ul className="space-y-2">
              {(slots ?? []).map((slot: any) => (
                <li key={slot.start} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <span className="text-sm">
                    {new Date(slot.start).toLocaleString()} - {new Date(slot.end).toLocaleTimeString()}
                  </span>
                  <button className="px-3 py-1 bg-black text-white rounded" onClick={() => book(slot)}>
                    Book
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}


