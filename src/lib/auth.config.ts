import type { NextAuthConfig } from "next-auth";

// Edge-safe base config shared by the middleware and the full server auth.
// It must NOT import Prisma or bcrypt — the middleware runs on the Edge runtime
// where those are unavailable. The Prisma-backed Credentials provider lives in
// auth.ts (route handlers / sign-in only).
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      // Edge layer only enforces authentication (redirect anon -> /login).
      // Role enforcement (ADMIN-only, with a non-admin -> /workspace redirect)
      // is done server-side in requireAdmin(), which the /admin layout runs.
      if (path.startsWith("/admin") || path.startsWith("/workspace")) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.clientId = (user as { clientId?: string }).clientId;
        token.uid = (user as { id?: string }).id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as string;
      session.user.clientId = token.clientId as string | undefined;
      return session;
    },
  },
};
