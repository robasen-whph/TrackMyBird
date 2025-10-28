import { NextResponse } from "next/server";
import { appConfig } from "@/config/app";

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "trackmybird",
    version: appConfig.version,
    time: new Date().toISOString(),
  });
}
