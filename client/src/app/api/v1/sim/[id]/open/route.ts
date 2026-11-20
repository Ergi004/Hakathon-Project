import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordSimEvent } from "@/server/simulation";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** 1×1 open-tracking pixel for internal phishing simulations (SPEC 9 B8). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (z.uuid().safeParse(id).success) await recordSimEvent(id, t, "opened");
  return new NextResponse(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
}
