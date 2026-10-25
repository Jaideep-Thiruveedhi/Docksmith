import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RepoOption {
  id: string;
  owner: string;
  name: string;
  trackedBranch: string;
}
export const selectClass =
  "h-11 max-w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RepositoryFilter({
  repos,
  action,
  repoId = "",
  query,
  status,
  search = false,
}: {
  repos: RepoOption[];
  action: string;
  repoId?: string;
  query?: string;
  status?: string;
  search?: boolean;
}) {
  return (
    <form
      action={action}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="min-w-44 flex-1 sm:max-w-xs">
        <label
          htmlFor="repo-filter"
          className="mb-2 block text-[11px] text-muted-foreground"
        >
          Repository
        </label>
        <select
          id="repo-filter"
          name="repoId"
          defaultValue={repoId}
          className={`${selectClass} w-full`}
        >
          <option value="">All repositories</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.owner}/{repo.name} · {repo.trackedBranch}
            </option>
          ))}
        </select>
      </div>
      {search && (
        <>
          <div className="min-w-40 flex-1">
            <label
              htmlFor="doc-search"
              className="mb-2 block text-[11px] text-muted-foreground"
            >
              Find a code unit
            </label>
            <Input
              id="doc-search"
              name="q"
              defaultValue={query}
              placeholder="Function name or file path…"
              maxLength={200}
            />
          </div>
          <div>
            <label
              htmlFor="status-filter"
              className="mb-2 block text-[11px] text-muted-foreground"
            >
              Documentation health
            </label>
            <select
              id="status-filter"
              name="status"
              defaultValue={status ?? ""}
              className={selectClass}
            >
              <option value="">Any status</option>
              <option value="OK">Up to date</option>
              <option value="REVIEW_RECOMMENDED">Review recommended</option>
              <option value="POTENTIALLY_OUTDATED">Potentially outdated</option>
              <option value="BROKEN">Breaking change</option>
            </select>
          </div>
        </>
      )}
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
    </form>
  );
}
