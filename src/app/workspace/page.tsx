import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadFacets } from "@/lib/facets";
import { WorkspaceClient } from "./WorkspaceClient";

export default async function WorkspacePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const facets = await loadFacets();
  return <WorkspaceClient facets={facets} />;
}
