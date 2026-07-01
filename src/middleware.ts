import { auth } from "@/lib/auth";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtected = path.startsWith("/workspace") || path.startsWith("/admin");
  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/workspace/:path*", "/admin/:path*"] };
