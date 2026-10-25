import { PageHeading, SetupNotice } from "@/components/shared";
import { ChatInterface } from "@/components/chat-interface";
import { readWorkspace, repoSelect } from "@/lib/data";
import { getConfiguration } from "@/lib/env";
import { filtersSchema, type SearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";
export default async function ChatPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = filtersSchema.safeParse(await searchParams);
  const { data: repos, error } = await readWorkspace((db) =>
    db.repository.findMany({ select: repoSelect, orderBy: { name: "asc" } }),
  );
  let configured = false;
  try {
    const config = getConfiguration();
    configured =
      config.database && config.llm && config.embeddings && config.vectorStore;
  } catch {
    /* SetupNotice reports invalid configuration. */
  }
  const requested = parsed.success ? parsed.data.repoId : undefined;
  return (
    <>
      <PageHeading
        eyebrow="Ask your codebase"
        title="Less searching. More understanding."
        description="A conversation with your repository, grounded in published docs and the latest synced source."
      />
      <SetupNotice message={error} />
      <ChatInterface
        repos={repos ?? []}
        initialRepoId={
          repos?.find((repo) => repo.id === requested)?.id ??
          repos?.[0]?.id ??
          ""
        }
        configured={configured}
      />
    </>
  );
}
