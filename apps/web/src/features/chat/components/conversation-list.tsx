import { Button, buttonVariants } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { Skeleton } from "@multi-tenant-ai-catalog/ui/components/skeleton";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { MessagesSquare, SquarePen, TriangleAlert } from "lucide-react";

import { formatRelativeDate } from "@/lib/format";

import { getChatErrorMessage } from "../errors";
import { useConversations } from "../hooks";

const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

/**
 * The user's conversations, most recent first (the server lists up to 50). Plain links
 * to `?c=<id>`: opening one is a navigation, so Back returns to the previous one.
 * `onNavigate` lets the mobile Sheet close after a choice.
 */
export function ConversationList({ activeId, onNavigate }: { activeId: string | null; onNavigate?: () => void }) {
  const conversations = useConversations();

  return (
    <nav aria-label="Histórico de conversas" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3">
        <Link
          to="/chat"
          search={{}}
          onClick={onNavigate}
          className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}
        >
          <SquarePen aria-hidden />
          Nova conversa
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {conversations.isPending ? (
          <ConversationListSkeleton />
        ) : conversations.isError && !conversations.data ? (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TriangleAlert />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Não foi possível carregar o histórico</EmptyTitle>
              <EmptyDescription>{getChatErrorMessage(conversations.error)}</EmptyDescription>
            </EmptyHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={() => conversations.refetch()}
              disabled={conversations.isRefetching}
            >
              Tentar novamente
            </Button>
          </Empty>
        ) : conversations.data.length === 0 ? (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquare />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Nenhuma conversa ainda</EmptyTitle>
              <EmptyDescription>Suas perguntas ao assistente aparecem aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.data.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <Link
                    to="/chat"
                    search={{ c: conversation.id }}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col gap-0.5 px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
                      active && "bg-muted",
                    )}
                  >
                    <span className={cn("truncate text-sm", active && "font-medium")}>{conversation.title}</span>
                    <time
                      dateTime={conversation.updatedAt}
                      title={fullDate.format(new Date(conversation.updatedAt))}
                      className="text-xs text-muted-foreground"
                    >
                      {formatRelativeDate(conversation.updatedAt)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-2.5 py-2" aria-busy="true" aria-label="Carregando conversas">
      {["w-4/5", "w-3/5", "w-11/12", "w-2/3", "w-3/4"].map((width) => (
        <div key={width} className="flex flex-col gap-1.5">
          <Skeleton className={cn("h-4", width)} />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
