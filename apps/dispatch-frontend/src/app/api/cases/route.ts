import { NextResponse } from "next/server";
import { actors } from "@/lib/actors";

export const dynamic = "force-dynamic";

const INDEX_ID = "main";

/** `POST /api/cases` `{ issue, symptoms, preferredSlot }` → `{ caseId }` */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{ issue: string; symptoms: string[]; preferredSlot: string }>;
  const id = `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const input = {
    id,
    issue: body.issue ?? "My AC isn't cooling.",
    symptoms: body.symptoms ?? ["Fan runs", "No cold air", "Outdoor unit not running"],
    preferredSlot: body.preferredSlot ?? "Today · 5:30–7:00 PM",
  };
  try {
    await actors.ServiceCase.get(id).create(input);
    await actors.CaseIndex.get(INDEX_ID).add(id);
    return NextResponse.json({ caseId: id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 503 });
  }
}

/** `GET /api/cases` → `{ caseIds }`, latest last */
export async function GET() {
  try {
    const caseIds = await actors.CaseIndex.get(INDEX_ID).list();
    return NextResponse.json({ caseIds });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 503 });
  }
}
