import { prisma } from "../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";

interface AppointmentWithRelations {
  id: string;
  start: Date;
  end: Date;
  summary: string | null;
  description: string | null;
  location: string | null;
  googleEventId: string;
  seller: {
    id: string;
    name: string | null;
    email: string | null;
  };
  buyer: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export default async function AppointmentsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const userId = (session.user as any).id as string;
  
  // Get user role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true }
  });

  const now = new Date();
  
  // Fetch appointments where user is either seller or buyer
  const [upcomingAppointments, pastAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: { 
        OR: [{ sellerId: userId }, { buyerId: userId }],
        start: { gt: now }
      },
      include: { 
        seller: { select: { id: true, name: true, email: true } },
        buyer: { select: { id: true, name: true, email: true } }
      },
      orderBy: { start: "asc" },
    }),
    prisma.appointment.findMany({
      where: { 
        OR: [{ sellerId: userId }, { buyerId: userId }],
        start: { lte: now }
      },
      include: { 
        seller: { select: { id: true, name: true, email: true } },
        buyer: { select: { id: true, name: true, email: true } }
      },
      orderBy: { start: "desc" },
      take: 10 // Limit past appointments
    })
  ]);

  const AppointmentCard = ({ appointment, isPast = false }: { appointment: AppointmentWithRelations, isPast?: boolean }) => {
    const isUserSeller = appointment.seller.id === userId;
    const otherParty = isUserSeller ? appointment.buyer : appointment.seller;
    const userRole = isUserSeller ? "Seller" : "Buyer";
    
    return (
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
        isPast ? "border-gray-400" : "border-blue-500"
      }`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {appointment.summary || "Appointment"}
            </h3>
            
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">
                  {new Date(appointment.start).toLocaleDateString()} at {new Date(appointment.start).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Duration: {Math.round((appointment.end.getTime() - appointment.start.getTime()) / (1000 * 60))} minutes
                </span>
              </div>
              
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>
                  {userRole === "Seller" ? "With" : "Booked with"}: {otherParty.name || otherParty.email}
                </span>
              </div>
              
              {appointment.location && (
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <a 
                    href={appointment.location} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Join Google Meet
                  </a>
                </div>
              )}
              
              {appointment.description && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  {appointment.description}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isPast 
                ? "bg-gray-100 text-gray-800" 
                : "bg-green-100 text-green-800"
            }`}>
              {isPast ? "Completed" : "Upcoming"}
            </span>
            
            <span className={`px-2 py-1 rounded-full text-xs ${
              userRole === "Seller" 
                ? "bg-blue-100 text-blue-800" 
                : "bg-purple-100 text-purple-800"
            }`}>
              You are the {userRole}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.name || session.user.name || session.user.email}
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/buyer" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Book New Appointment
          </Link>
          {user?.role === "SELLER" && (
            <Link 
              href="/dashboard" 
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Seller Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upcoming</h3>
          <p className="text-3xl font-bold text-blue-600">{upcomingAppointments.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{pastAppointments.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total</h3>
          <p className="text-3xl font-bold text-gray-600">{upcomingAppointments.length + pastAppointments.length}</p>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900">Upcoming Appointments</h2>
        {upcomingAppointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming appointments</h3>
            <p className="text-gray-600 mb-4">You don't have any appointments scheduled.</p>
            <Link 
              href="/buyer" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Book an Appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900">Recent Past Appointments</h2>
          <div className="space-y-4">
            {pastAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} isPast />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}


