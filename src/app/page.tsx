import App from "@/components/App";
import { snapshot } from "@/lib/api";
import { LIBRARY } from "@/lib/library";

export const dynamic = "force-dynamic";

export default function Page() {
  return <App initial={snapshot()} library={LIBRARY} />;
}
