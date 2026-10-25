export type Severity =
  "OK" | "REVIEW_RECOMMENDED" | "POTENTIALLY_OUTDATED" | "BROKEN";
interface Fingerprint {
  signatureHash: string;
  bodyHash: string;
}

export function classifyStaleness(
  current: Fingerprint | null,
  published: Fingerprint | null,
  relatedChange = false,
): { status: Severity; reason: string | null } {
  if (!current)
    return {
      status: "BROKEN",
      reason: "This code unit was removed from the tracked branch.",
    };
  if (!published) return { status: "OK", reason: null };
  if (current.signatureHash !== published.signatureHash) {
    return {
      status: "BROKEN",
      reason:
        "The public signature changed since the published documentation was generated.",
    };
  }
  if (current.bodyHash !== published.bodyHash) {
    return {
      status: "POTENTIALLY_OUTDATED",
      reason:
        "The implementation changed since the published documentation was generated.",
    };
  }
  if (relatedChange)
    return {
      status: "REVIEW_RECOMMENDED",
      reason:
        "Another source file in the same directory changed. Review related behavior.",
    };
  return { status: "OK", reason: null };
}
