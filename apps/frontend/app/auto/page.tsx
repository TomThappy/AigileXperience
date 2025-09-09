import { redirect } from "next/navigation";

/**
 * Permanent redirect from /auto to the new venture dossier route
 */
export default function AutoPage() {
  // 301 permanent redirect to the new elevator route
  redirect("/workspaces/demo/dossier/elevator");
}
