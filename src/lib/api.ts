import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";

export const idSchema = z.string().cuid();

export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const text = await request.text();
  if (Buffer.byteLength(text) > 1_000_000)
    throw new AppError("Request body is too large.", 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new AppError("Request body must be valid JSON.", 400);
  }
  return schema.parse(input);
}

export async function api<T>(operation: () => Promise<T>) {
  try {
    return NextResponse.json(await operation());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (
      error instanceof Error &&
      /^(Configure |Invalid environment configuration:)/.test(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error(
      "Docsmith operation failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "The operation failed. Check database connectivity and service configuration, then try again.",
      },
      { status: 500 },
    );
  }
}
