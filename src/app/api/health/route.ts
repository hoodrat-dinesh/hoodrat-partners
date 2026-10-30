import { NextResponse } from "next/server";
import { configurationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const configuration = configurationStatus();
  return NextResponse.json({
    ok: configuration.supabasePublic,
    configuration,
    timestamp: new Date().toISOString(),
  });
}
