import { fail, snapshot } from "@/lib/api";
import { runStep } from "@/lib/steps";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { n } = (await req.json()) as { n: number };
    await mutate((db) => runStep(db, n));
    return Response.json(snapshot());
  } catch (e) {
    return fail(e);
  }
}
