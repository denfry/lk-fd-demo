import { auth } from "@/lib/auth";

export async function getClientId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.clientId ?? null;
}
