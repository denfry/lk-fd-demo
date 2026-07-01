import { loadFacets } from "@/lib/facets";
import { WorkspaceClient } from "./WorkspaceClient";

export default async function WorkspacePage() {
  const facets = await loadFacets();
  return <WorkspaceClient facets={facets} />;
}
