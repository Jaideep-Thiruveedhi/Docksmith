export async function requestJson<T>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    ...(options.body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }
      : {}),
    signal: options.signal,
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The server returned an unexpected response. Please retry.",
    );
  }
  if (!response.ok) {
    const data = result as {
      error?: string;
      issues?: { path: string; message: string }[];
    };
    throw new Error(
      data.issues
        ?.map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ") ||
        data.error ||
        `Request failed (${response.status}).`,
    );
  }
  return result as T;
}
