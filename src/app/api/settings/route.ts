import { fail, snapshot } from "@/lib/api";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { review } = (await req.json()) as { review: boolean };
    await mutate((db) => {
      db.settings.review = !!review;
    });
    return Response.json(snapshot());
  } catch (e) {
    return fail(e);
  }
}
