import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@multi-tenant-ai-catalog/ui/components/collapsible";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { Check, ChevronRight, CircleAlert, Database, LoaderCircle } from "lucide-react";

import type { ToolCallSummary } from "../api";
import type { ToolActivity } from "../hooks";
import { describeToolInput, toolResultLabel, toolRunningLabel, toolTitle } from "../tool-labels";

/**
 * One chip per tool call while the agent works: "Buscando produtos: kit presente…" turns
 * into "8 produtos encontrados" when its tool_end arrives.
 */
export function ToolActivityChips({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Consultas ao catálogo">
      {tools.map((tool, index) => (
        // A call has no id in the stream; the list only grows, so the index is stable.
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only list without ids
        <li key={index}>
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 border px-2 py-1 text-xs",
              tool.status === "running" ? "text-foreground" : "text-muted-foreground",
              tool.status === "error" && "border-destructive/40",
            )}
          >
            {tool.status === "running" ? (
              <LoaderCircle className="size-3.5 shrink-0 motion-safe:animate-spin" aria-hidden />
            ) : tool.status === "done" ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
            )}
            <span className="truncate">
              {tool.status === "running"
                ? toolRunningLabel(tool.name, tool.input)
                : toolResultLabel(tool.name, tool.resultCount, tool.error)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What a finished answer queried, collapsed by default. Shows the input exactly as the
 * server validated it (unknown keys stripped, null if rejected), so it doubles as a view
 * of the tool calling for whoever evaluates the agent.
 */
export function ToolCallsDisclosure({ calls }: { calls: ToolCallSummary[] }) {
  if (calls.length === 0) return null;
  return (
    <Collapsible className="flex flex-col gap-2">
      <CollapsibleTrigger className="group/trigger inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring">
        <Database className="size-3.5" aria-hidden />
        Consultou o catálogo
        <span className="tabular-nums">({calls.length})</span>
        <ChevronRight
          className="size-3.5 transition-transform group-data-[panel-open]/trigger:rotate-90"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-2 border-l pl-3">
          {calls.map((call, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stored calls have no id and never reorder
            <li key={index} className="flex flex-col gap-1 text-xs">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{toolTitle(call.name)}</span>
                <code className="font-mono text-muted-foreground">{call.name}</code>
                <span className={cn("text-muted-foreground", call.error !== undefined && "text-destructive")}>
                  → {toolResultLabel(call.name, call.resultCount, call.error)}
                </span>
              </div>
              <ToolInput input={call.input} />
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolInput({ input }: { input: unknown }) {
  if (input === null) {
    return <p className="text-muted-foreground">Parâmetros inválidos: recusados antes de consultar o banco.</p>;
  }
  const rows = describeToolInput(input);
  if (rows.length === 0) return <p className="text-muted-foreground">Sem filtros.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt>{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
