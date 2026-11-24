import { snapshot } from "@/lib/api";
import { emptyDb, mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  await mutate((db) => {
    const review = db.settings.review;
    Object.assign(db, emptyDb());
    db.settings.review = review;
  });
  return Response.json(snapshot());
}
