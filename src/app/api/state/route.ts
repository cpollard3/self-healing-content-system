import { snapshot } from "@/lib/api";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(snapshot());
}
