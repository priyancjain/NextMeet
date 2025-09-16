import { prisma } from "../../lib/prisma";
import { getServerSession } from "next-auth";

export default async function AppointmentsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    return (
      <main>
        <p>Please sign in to view appointments.</p>
      </main>
    );
  }

  const userId = (session.user as any).id as string;
  const appointments = await prisma.appointment.findMany({
    where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    include: { seller: true, buyer: true },
    orderBy: { start: "asc" },
  });

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Appointments</h1>
      <ul className="space-y-2">
        {appointments.map((a) => (
          <li key={a.id} className="p-3 bg-gray-50 rounded">
            <div className="text-sm">
              <span className="font-medium">{a.summary || "Appointment"}</span>
              <span className="ml-2 text-gray-600">
                {new Date(a.start).toLocaleString()} - {new Date(a.end).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              Seller: {a.seller.name || a.seller.email} | Buyer: {a.buyer.name || a.buyer.email}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}


