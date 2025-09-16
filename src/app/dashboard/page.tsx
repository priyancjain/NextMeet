import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function SellerDashboardPage() {
  const session = await getServerSession();

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Seller Dashboard</h1>
      {!session ? (
        <div>
          <p className="text-sm">Sign in to connect your Google Calendar.</p>
          <a className="px-3 py-2 bg-black text-white rounded" href="/api/auth/signin">Sign in with Google</a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">Signed in as {session.user?.email}</p>
          <p className="text-sm">Google Calendar connected after granting permissions during sign-in.</p>
          <div className="flex gap-2">
            <Link className="px-3 py-2 bg-gray-800 text-white rounded" href="/appointments">View Appointments</Link>
          </div>
        </div>
      )}
    </main>
  );
}
