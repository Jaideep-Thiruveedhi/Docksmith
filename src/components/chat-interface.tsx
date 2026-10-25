"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BookOpen,
  Bot,
  FileCode2,
  LoaderCircle,
  MessageSquare,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { selectClass, type RepoOption } from "@/components/repository-filter";
import { requestJson } from "@/lib/client";
import type { ChatMessageView, SessionView } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export function ChatInterface({
  repos,
  initialRepoId,
  configured,
}: {
  repos: RepoOption[];
  initialRepoId: string;
  configured: boolean;
}) {
  const [repoId, setRepoId] = useState(initialRepoId);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialRepoId));
  const [error, setError] = useState("");
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repoId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      repoId,
      ...(sessionId ? { sessionId } : {}),
    });
    requestJson<{ sessions: SessionView[]; messages: ChatMessageView[] }>(
      `/api/chat?${params}`,
      { signal: controller.signal },
    )
      .then((result) => {
        setSessions(result.sessions);
        setMessages(result.messages);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load chat history.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [repoId, sessionId]);

  useEffect(() => {
    const element = transcript.current;
    element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function chooseSession(id?: string) {
    setLoading(true);
    setError("");
    setMessages([]);
    setSessionId(id);
    if (id === sessionId) setLoading(false);
  }

  async function send() {
    const message = input.trim();
    if (!message || !repoId || sending || loading || !configured) return;
    setSending(true);
    setError("");
    setInput("");
    const temporaryId = `pending-${Date.now()}`;
    setMessages((previous) => [
      ...previous,
      { id: temporaryId, role: "USER", content: message, sources: [] },
    ]);
    try {
      const result = await requestJson<{
        sessionId: string;
        messages: ChatMessageView[];
      }>("/api/chat", { method: "POST", body: { repoId, sessionId, message } });
      setMessages((previous) => [
        ...previous.filter((entry) => entry.id !== temporaryId),
        ...result.messages,
      ]);
      setSessionId(result.sessionId);
      try {
        const history = await requestJson<{ sessions: SessionView[] }>(
          `/api/chat?repoId=${repoId}`,
        );
        setSessions(history.sessions);
      } catch {
        /* A history refresh failure must not turn a saved message into a failed send. */
      }
    } catch (error) {
      setMessages((previous) =>
        previous.filter((entry) => entry.id !== temporaryId),
      );
      setInput(message);
      setError(
        error instanceof Error
          ? error.message
          : "The message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-h-[650px] overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-background/40 p-4 lg:border-b-0 lg:border-r">
        <label
          htmlFor="chat-repo"
          className="mb-2 block text-[11px] font-medium text-muted-foreground"
        >
          Repository context
        </label>
        <select
          id="chat-repo"
          value={repoId}
          disabled={sending}
          onChange={(event) => {
            setRepoId(event.target.value);
            setSessionId(undefined);
            setMessages([]);
            setSessions([]);
            setLoading(Boolean(event.target.value));
            setError("");
          }}
          className={`${selectClass} w-full text-xs`}
        >
          <option value="">Choose a repository</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.owner}/{repo.name} · {repo.trackedBranch}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={!repoId || sending || loading}
          onClick={() => chooseSession()}
        >
          <Plus aria-hidden="true" />
          New conversation
        </Button>
        <h2 className="mb-3 mt-7 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent conversations
        </h2>
        <div className="flex max-h-32 gap-2 overflow-auto lg:max-h-[460px] lg:flex-col">
          {sessions.map((session) => (
            <button
              key={session.id}
              disabled={sending}
              onClick={() => chooseSession(session.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg p-2.5 text-left text-xs transition-colors lg:w-full",
                sessionId === session.id
                  ? "bg-primary/10 text-violet-200"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-44 truncate">{session.title}</span>
            </button>
          ))}
          {!sessions.length && (
            <p className="text-xs leading-6 text-muted-foreground/65">
              Your conversations are saved with this repository.
            </p>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
          <Bot className="size-5 text-violet-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-medium">Codebase assistant</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Answers with code and documentation references
            </p>
          </div>
          <span className="ml-auto rounded-full border border-violet-400/20 bg-violet-400/8 px-2 py-1 text-[10px] text-violet-300">
            RAG
          </span>
        </div>
        <div
          ref={transcript}
          className="max-h-[580px] min-h-80 flex-1 overflow-y-auto p-5 sm:p-7"
          aria-live="polite"
          aria-busy={sending || loading}
        >
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Loading conversation…
            </p>
          )}
          {!messages.length && !loading && (
            <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
              <div className="mb-6 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                <BookOpen
                  className="size-8 text-violet-300"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">
                Get to know your codebase.
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Ask how it works, where something lives, or what changed.
                Docsmith finds the context and shows its sources.
              </p>
              <div className="mt-7 grid w-full gap-2">
                {[
                  "What does this repository do?",
                  "Where are the main entry points?",
                  "How does error handling work?",
                ].map((question) => (
                  <button
                    key={question}
                    disabled={!repoId || !configured}
                    onClick={() => setInput(question)}
                    className="rounded-lg border border-border px-4 py-3 text-left text-xs text-muted-foreground hover:border-violet-400/30 hover:text-foreground disabled:opacity-40"
                  >
                    {question}
                    <span
                      className="float-right text-violet-300"
                      aria-hidden="true"
                    >
                      ↗
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-7">
            {messages.map((message) => (
              <article key={message.id} className="flex gap-3 sm:gap-4">
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    message.role === "USER"
                      ? "border-border bg-secondary"
                      : "border-violet-400/20 bg-violet-400/10 text-violet-300",
                  )}
                >
                  {message.role === "USER" ? (
                    <User className="size-4" aria-hidden="true" />
                  ) : (
                    <Bot className="size-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-semibold">
                    {message.role === "USER" ? "You" : "Docsmith"}
                  </p>
                  <Markdown>{message.content}</Markdown>
                  {message.sources.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source, index) => (
                          <Link
                            key={`${source.documentId}-${index}`}
                            href={`/docs/${source.codeUnitId}`}
                            className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-[10px] text-violet-200 hover:border-violet-400/35"
                          >
                            <FileCode2
                              className="size-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              [{index + 1}] {source.filePath}:{source.startLine}
                            </span>
                            {source.status !== "OK" && (
                              <span className="text-amber-300">· stale</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {sending && (
            <p className="ml-12 mt-5 flex items-center gap-2 text-xs text-violet-300">
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
              Reading the relevant source…
            </p>
          )}
        </div>
        <form
          className="border-t border-border p-4 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {!configured && (
            <p className="mb-3 text-xs leading-5 text-amber-200/80">
              Configure your LLM provider, HuggingFace, and Qdrant in .env.local
              to enable chat.
            </p>
          )}
          {error && (
            <p role="alert" className="mb-3 text-xs leading-5 text-red-300">
              {error}
            </p>
          )}
          <label htmlFor="chat-message" className="sr-only">
            Ask a question about your repository
          </label>
          <div className="relative">
            <Textarea
              id="chat-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                repoId
                  ? "Ask anything about this repository…"
                  : "Choose a repository to begin…"
              }
              className="min-h-20 resize-none pr-14"
              maxLength={8000}
              disabled={!repoId || !configured || sending || loading}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute bottom-3 right-3 size-8"
              aria-label="Send message"
              disabled={
                !input.trim() || !repoId || !configured || sending || loading
              }
            >
              <ArrowUp aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/65">
            Grounded in your repository. Review cited source code before relying
            on an answer.
          </p>
        </form>
      </div>
    </div>
  );
}
