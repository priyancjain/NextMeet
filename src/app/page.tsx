import Image from "next/image";

export default function Home() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Next.js Scheduler</h1>
      <p className="text-sm text-gray-600 max-w-2xl">
        Sign in with Google as a Seller to connect your calendar and expose availability.
        Buyers can search sellers, view available slots, and book appointments created in both calendars.
      </p>
      <div className="flex gap-3">
        <a className="px-4 py-2 bg-black text-white rounded" href="/dashboard">Go to Seller Dashboard</a>
        <a className="px-4 py-2 bg-gray-800 text-white rounded" href="/buyer">Go to Buyer Booking</a>
      </div>
    </main>
  );
}
