import "server-only";
import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { requireEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

let client: QdrantClient | undefined;
let collectionReady: Promise<void> | undefined;
function getQdrant() {
  const env = requireEnv("QDRANT_URL", "QDRANT_API_KEY");
  return (client ??= new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
    timeout: 30_000,
  }));
}

export function pointId(codeUnitId: string): string {
  const hex = createHash("sha256")
    .update(codeUnitId)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function ensureCollection(): Promise<void> {
  if (collectionReady) return collectionReady;
  collectionReady = (async () => {
    const env = requireEnv("QDRANT_URL", "QDRANT_API_KEY");
    const qdrant = getQdrant();
    if (!(await qdrant.collectionExists(env.QDRANT_COLLECTION)).exists) {
      try {
        await qdrant.createCollection(env.QDRANT_COLLECTION, {
          vectors: { size: env.EMBEDDING_DIMENSIONS, distance: "Cosine" },
        });
      } catch (error) {
        if (!(await qdrant.collectionExists(env.QDRANT_COLLECTION)).exists)
          throw error;
      }
    }
    const info = await qdrant.getCollection(env.QDRANT_COLLECTION);
    const vectors = info.config.params.vectors;
    if (
      !vectors ||
      !("size" in vectors) ||
      vectors.size !== env.EMBEDDING_DIMENSIONS
    )
      throw new AppError(
        "Qdrant collection dimensions differ from EMBEDDING_DIMENSIONS. Select a new collection or restore the original model configuration.",
        409,
      );
    if (!info.payload_schema?.repoId)
      await qdrant.createPayloadIndex(env.QDRANT_COLLECTION, {
        field_name: "repoId",
        field_schema: "keyword",
        wait: true,
      });
  })().catch((error) => {
    collectionReady = undefined;
    throw error;
  });
  return collectionReady;
}

export async function upsertVector(
  codeUnitId: string,
  repoId: string,
  documentId: string,
  vector: number[],
) {
  await ensureCollection();
  const env = requireEnv("QDRANT_URL", "QDRANT_API_KEY");
  await getQdrant().upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: [
      {
        id: pointId(codeUnitId),
        vector,
        payload: { codeUnitId, repoId, documentId },
      },
    ],
  });
}

export async function searchVectors(vector: number[], repoId: string) {
  await ensureCollection();
  const env = requireEnv("QDRANT_URL", "QDRANT_API_KEY");
  const result = await getQdrant().query(env.QDRANT_COLLECTION, {
    query: vector,
    limit: 8,
    filter: { must: [{ key: "repoId", match: { value: repoId } }] },
    with_payload: true,
  });
  return result.points.flatMap((point) =>
    typeof point.payload?.codeUnitId === "string" &&
    typeof point.payload?.documentId === "string"
      ? [
          {
            codeUnitId: point.payload.codeUnitId,
            documentId: point.payload.documentId,
            score: point.score,
          },
        ]
      : [],
  );
}

export async function deleteRepositoryVectors(repoId: string) {
  const env = requireEnv("QDRANT_URL", "QDRANT_API_KEY");
  const qdrant = getQdrant();
  if ((await qdrant.collectionExists(env.QDRANT_COLLECTION)).exists)
    await qdrant.delete(env.QDRANT_COLLECTION, {
      wait: true,
      filter: { must: [{ key: "repoId", match: { value: repoId } }] },
    });
}
