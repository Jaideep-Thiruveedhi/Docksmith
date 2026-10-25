import "server-only";
import { pipeline } from "@huggingface/transformers";
import { requireEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function normalizeEmbedding(
  input: unknown,
  dimensions: number,
): number[] {
  let output = input;

  if (
    Array.isArray(output) &&
    output.length === 1 &&
    Array.isArray(output[0]) &&
    Array.isArray(output[0][0])
  ) {
    output = output[0];
  }

  if (!Array.isArray(output) || !output.length) {
    throw new AppError(
      "The embedding provider returned an empty vector.",
      502,
    );
  }

  let vector: number[];

  if (output.every((value) => typeof value === "number")) {
    vector = output as number[];
  } else if (
    output.every(
      (row) =>
        Array.isArray(row) &&
        row.length === dimensions &&
        row.every(
          (value) =>
            typeof value === "number" && Number.isFinite(value),
        ),
    )
  ) {
    const rows = output as number[][];

    vector = Array.from(
      { length: dimensions },
      (_, index) =>
        rows.reduce((sum, row) => sum + row[index], 0) /
        rows.length,
    );
  } else {
    throw new AppError(
      "The embedding provider returned an unsupported vector shape.",
      502,
    );
  }

  if (
    vector.length !== dimensions ||
    !vector.every(Number.isFinite)
  ) {
    throw new AppError(
      "Embedding dimensions do not match EMBEDDING_DIMENSIONS.",
      502,
    );
  }

  const magnitude = Math.hypot(...vector);

  if (!magnitude) {
    throw new AppError(
      "The embedding provider returned a zero vector.",
      502,
    );
  }

  return vector.map((value) => value / magnitude);
}

// Reuse the loaded model instead of loading it for every request.
let extractorPromise: Promise<any> | undefined;

async function getExtractor(model: string): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", model);
  }

  try {
    return await extractorPromise;
  } catch (error) {
    extractorPromise = undefined;
    throw error;
  }
}

export async function generateEmbedding(
  text: string,
): Promise<number[]> {
  const env = requireEnv(
    "HUGGINGFACE_EMBEDDING_MODEL",
    "EMBEDDING_DIMENSIONS",
  );

  try {
    const extractor = await getExtractor(
      env.HUGGINGFACE_EMBEDDING_MODEL,
    );

    const result = await extractor(text.slice(0, 8000), {
      pooling: "mean",
      normalize: true,
      truncation: true,
    });

    const values =
      typeof result?.tolist === "function"
        ? result.tolist()
        : result;

    return normalizeEmbedding(
      values,
      env.EMBEDDING_DIMENSIONS,
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Local embedding generation failed:", error);

    throw new AppError(
      "Local embedding generation failed. Check the model download and local Transformers.js configuration.",
      502,
    );
  }
}