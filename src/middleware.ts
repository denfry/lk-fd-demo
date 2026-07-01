import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe middleware: uses only the base config (no Prisma/bcrypt). The
// `authorized` callback in authConfig decides access and triggers the redirect
// to /login for protected paths.
export default NextAuth(authConfig).auth;

export const config = { matcher: ["/workspace/:path*", "/admin/:path*"] };
