import { NextResponse } from "next/server";
import { actors } from "@/lib/actors";
import { projectCase, type ActorCase } from "@/lib/caseProjection";

export const dynamic = "force-dynamic";

/** `GET /api/cases/:id` → the dashboard's ServiceCase (docs/plan-1h.md §3) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const raw = (await actors.ServiceCase.get(id).get()) as ActorCase;
    const projected = projectCase(raw);
    if (!projected) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(projected);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 503 });
  }
}
