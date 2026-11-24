import { fail, snapshot } from "@/lib/api";
import { LIBRARY } from "@/lib/library";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { docIds } = (await req.json()) as { docIds: string[] };
    await mutate((db) => {
      if (db.completed > 0) throw new Error("Docs are already loaded. Reset the demo to choose again.");
      db.selectedDocIds = LIBRARY.filter((d) => d.original && docIds.includes(d.id)).map((d) => d.id);
    });
    return Response.json(snapshot());
  } catch (e) {
    return fail(e);
  }
}
