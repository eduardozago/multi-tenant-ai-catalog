import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@multi-tenant-ai-catalog/ui/components/message-scroller";
import { Skeleton } from "@multi-tenant-ai-catalog/ui/components/skeleton";
import { ArrowDown, MessageSquareOff, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { useSession } from "@/features/auth/hooks";
import { ApiError } from "@/lib/api-client";

import type { ChatMessage } from "../api";
import { getChatErrorMessage } from "../errors";
import { type ChatStreamState, useChatStream, useConversation } from "../hooks";
import { ChatEmptyState } from "./chat-empty-state";
import { AssistantMessage, ChatErrorNotice, StoppedNotice, UserMessage } from "./chat-message";
import { Composer } from "./composer";

/**
 * One conversation: history, the answer being streamed, and the composer.
 * `conversationId` null is a new conversation; the first finished answer creates it on
 * the server and `onConversationCreated` receives its id.
 */
export function ChatView({
  conversationId,
  onConversationCreated,
  onNewConversation,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onNewConversation: () => void;
}) {
  return (
    // autoScroll: follows the bottom while the answer grows, until the user scrolls up
    // (wheel, touch, keys); scrolling back to the end resumes it.
    <MessageScrollerProvider autoScroll>
      <ChatViewContent
        conversationId={conversationId}
        onConversationCreated={onConversationCreated}
        onNewConversation={onNewConversation}
      />
    </MessageScrollerProvider>
  );
}

function ChatViewContent({
  conversationId,
  onConversationCreated,
  onNewConversation,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onNewConversation: () => void;
}) {
  const { user } = useSession();
  const conversation = useConversation(conversationId);
  const chat = useChatStream(conversationId);
  const { scrollToEnd } = useMessageScroller();

  // Opening another conversation starts at its end, even if the previous one was scrolled up.
  useEffect(() => {
    scrollToEnd({ behavior: "auto" });
  }, [conversationId, scrollToEnd]);

  const send = async (message: string) => {
    // Sending is an explicit "take me to the answer", even from far up the history.
    scrollToEnd({ behavior: "smooth" });
    const id = await chat.send(message);
    if (id && conversationId === null) onConversationCreated(id);
  };

  const retry = async () => {
    scrollToEnd({ behavior: "smooth" });
    const id = await chat.retry();
    if (id && conversationId === null) onConversationCreated(id);
  };

  const streaming = chat.state.status === "streaming";
  const messages = conversation.data?.messages ?? [];
  const loading = conversationId !== null && conversation.isPending;
  const loadError = conversationId !== null && !conversation.data && conversation.isError;
  const isEmpty = conversationId === null && chat.state.status === "idle";

  let body: ReactNode;
  if (loading) body = <ConversationSkeleton />;
  else if (loadError) {
    body = (
      <ConversationLoadError
        error={conversation.error}
        onRetry={() => conversation.refetch()}
        retrying={conversation.isRefetching}
        onNewConversation={onNewConversation}
      />
    );
  } else if (isEmpty && user) {
    body = <ChatEmptyState userName={user.name} companyName={user.company.name} onPick={send} />;
  } else {
    body = (
      <>
        {messages.map((message, index) => (
          // Messages are append-only and have no id: the index is stable within a conversation.
          <MessageScrollerItem key={`${conversationId}-${index}`} messageId={`${conversationId}-${index}`}>
            <StoredMessage message={message} />
          </MessageScrollerItem>
        ))}
        <PendingExchange state={chat.state} onRetry={retry} />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport aria-label="Mensagens">
          <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-6">{body}</MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          size={streaming ? "sm" : "icon-sm"}
          aria-label={streaming ? undefined : "Ir para a última mensagem"}
        >
          <ArrowDown aria-hidden />
          {streaming && "Novas mensagens"}
        </MessageScrollerButton>
      </MessageScroller>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3">
        <Composer
          streaming={streaming}
          disabled={loading || loadError}
          onSend={send}
          onStop={chat.stop}
        />
      </div>
    </div>
  );
}

function StoredMessage({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <UserMessage content={message.content} />;
  return <AssistantMessage text={message.content} />;
}

/** The exchange not in the cache yet: streaming, failed or stopped (see useChatStream). */
function PendingExchange({ state, onRetry }: { state: ChatStreamState; onRetry: () => void }) {
  if (state.message === null) return null;
  return (
    <>
      <MessageScrollerItem messageId="pending-user">
        <UserMessage content={state.message} />
      </MessageScrollerItem>
      <MessageScrollerItem messageId="pending-assistant">
        {state.status === "error" ? (
          // A partial answer that then failed is dropped: the server did not keep it either.
          <ChatErrorNotice error={state.error} onRetry={onRetry} />
        ) : (
          <AssistantMessage text={state.text} streaming={state.status === "streaming"}>
            {state.status === "stopped" && <StoppedNotice onRetry={onRetry} />}
          </AssistantMessage>
        )}
      </MessageScrollerItem>
    </>
  );
}

const SKELETON_ROWS = [
  { align: "end", width: "w-2/5" },
  { align: "start", width: "w-4/5" },
  { align: "end", width: "w-1/3" },
  { align: "start", width: "w-3/4" },
] as const;

function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando conversa">
      {SKELETON_ROWS.map((row) => (
        <div key={`${row.align}-${row.width}`} className={row.align === "end" ? "flex justify-end" : "flex gap-2"}>
          {row.align === "start" && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <Skeleton className={`${row.width} ${row.align === "end" ? "h-9" : "h-16"}`} />
        </div>
      ))}
    </div>
  );
}

function ConversationLoadError({
  error,
  onRetry,
  retrying,
  onNewConversation,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  onNewConversation: () => void;
}) {
  // 404 for a conversation that was never this user's or no longer exists: retrying
  // cannot help, starting over can.
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <Empty className="m-auto">
      <EmptyHeader>
        <EmptyMedia variant="icon">{notFound ? <MessageSquareOff /> : <TriangleAlert />}</EmptyMedia>
        <EmptyTitle>{notFound ? "Conversa não encontrada" : "Não foi possível carregar a conversa"}</EmptyTitle>
        <EmptyDescription>
          {notFound ? "Ela não existe ou não pertence à sua conta." : getChatErrorMessage(error)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {!notFound && (
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            Tentar novamente
          </Button>
        )}
        <Button variant={notFound ? "default" : "ghost"} onClick={onNewConversation}>
          Nova conversa
        </Button>
      </EmptyContent>
    </Empty>
  );
}
