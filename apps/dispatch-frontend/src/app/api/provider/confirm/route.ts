import { NextResponse } from "next/server";
import { actors } from "@/lib/actors";
import { PROVIDER_ID } from "@/lib/homeTwin";

export const dynamic = "force-dynamic";

/** `POST /api/provider/confirm` `{ caseId }`: the shop's CONFIRM click lets the provider agent book. */
export async function POST(req: Request) {
  const { caseId } = (await req.json().catch(() => ({}))) as { caseId?: string };
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });
  try {
    await actors.ProviderCalendar.get(PROVIDER_ID).approve(caseId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 503 });
  }
}
