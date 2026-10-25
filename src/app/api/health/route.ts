import { NextResponse } from "next/server";
import { getConfiguration } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET() {
  try {
    const configuration = getConfiguration();
    if (!configuration.database)
      return NextResponse.json(
        { status: "setup_required", configuration },
        { status: 503 },
      );
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      configuration,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: "Check environment configuration and database connectivity.",
      },
      { status: 503 },
    );
  }
}
