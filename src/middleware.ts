export { auth as middleware } from "next-auth";

export const config = {
  matcher: ["/dashboard/:path*", "/buyer/:path*", "/appointments"],
};


