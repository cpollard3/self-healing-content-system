import { fail, snapshot } from "@/lib/api";
import { decide } from "@/lib/steps";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = (await req.json()) as { action: "approve" | "reject" | "undo" };
    await mutate((db) => decide(db, id, action));
    return Response.json(snapshot());
  } catch (e) {
    return fail(e);
  }
}
