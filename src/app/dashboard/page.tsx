import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "../../lib/prisma";
import { redirect } from "next/navigation";

interface DashboardStats {
  totalAppointments: number;
  upcomingAppointments: number;
  calendarConnected: boolean;
}

async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedRefreshToken: true }
  });

  const now = new Date();
  const [totalAppointments, upcomingAppointments] = await Promise.all([
    prisma.appointment.count({ where: { sellerId: userId } }),
    prisma.appointment.count({ 
      where: { 
        sellerId: userId,
        start: { gt: now }
      } 
    })
  ]);

  return {
    totalAppointments,
    upcomingAppointments,
    calendarConnected: !!user?.encryptedRefreshToken
  };
}

export default async function SellerDashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const userId = (session.user as any).id as string;
  
  // Check if user is a seller
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (user?.role !== "SELLER") {
    redirect("/buyer");
  }

  const stats = await getDashboardStats(userId);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
        <div className="flex gap-3">
          <Link 
            href="/appointments" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Appointments
          </Link>
          <Link 
            href="/api/auth/signout" 
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Sign Out
          </Link>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{session.user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{session.user.name || "Not set"}</p>
          </div>
        </div>
      </div>

      {/* Calendar Connection Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Google Calendar Integration</h2>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            stats.calendarConnected ? "bg-green-500" : "bg-red-500"
          }`}></div>
          <span className={`font-medium ${
            stats.calendarConnected ? "text-green-700" : "text-red-700"
          }`}>
            {stats.calendarConnected ? "Connected" : "Not Connected"}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {stats.calendarConnected 
            ? "Your Google Calendar is connected and buyers can see your availability."
            : "Connect your Google Calendar to allow buyers to book appointments."
          }
        </p>
        {!stats.calendarConnected && (
          <Link 
            href="/api/auth/signin" 
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Google Calendar
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Appointments</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalAppointments}</p>
          <p className="text-sm text-gray-600 mt-1">All time</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upcoming Appointments</h3>
          <p className="text-3xl font-bold text-green-600">{stats.upcomingAppointments}</p>
          <p className="text-sm text-gray-600 mt-1">Scheduled ahead</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/appointments" 
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">Manage Appointments</h3>
            <p className="text-sm text-gray-600 mt-1">View and manage your scheduled appointments</p>
          </Link>
          <Link 
            href="/buyer" 
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">Test Booking Flow</h3>
            <p className="text-sm text-gray-600 mt-1">See how buyers book appointments with you</p>
          </Link>
          <a 
            href="https://calendar.google.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">Open Google Calendar</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your calendar directly</p>
          </a>
        </div>
      </div>
    </main>
  );
}
