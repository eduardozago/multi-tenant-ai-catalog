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
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useSession } from "@/features/auth/hooks";
import type { Product } from "@/features/products/api";
import { ProductDetailSheet } from "@/features/products/components/product-detail-sheet";
import { ApiError } from "@/lib/api-client";

import type { ChatMessage } from "../api";
import { getChatErrorMessage } from "../errors";
import { type ChatStreamState, useChatStream, useConversation } from "../hooks";
import { ChatEmptyState } from "./chat-empty-state";
import { AssistantMessage, ChatErrorNotice, StoppedNotice, UserMessage } from "./chat-message";
import { Composer } from "./composer";
import { ProductResults } from "./product-results";
import { ToolActivityChips, ToolCallsDisclosure } from "./tool-activity";

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
  const chat = useChatStream(conversationId);
  // Not `conversationId`: a conversation created here is shown before the URL has its id.
  const viewId = chat.viewId;
  const conversation = useConversation(viewId);
  const { scrollToEnd } = useMessageScroller();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Same sheet as the catalog, read-only here (no actions): the product was cited by the
  // agent, and editing belongs to the catalog page.
  const [detail, setDetail] = useState<{ product: Product | null; open: boolean }>({ product: null, open: false });
  const openProduct = (product: Product) => setDetail({ product, open: true });

  // Opening another conversation starts at its end, even if the previous one was scrolled up.
  useEffect(() => {
    scrollToEnd({ behavior: "auto" });
  }, [viewId, scrollToEnd]);

  const send = async (message: string) => {
    // Sending is an explicit "take me to the answer", even from far up the history.
    scrollToEnd({ behavior: "smooth" });
    const id = await chat.send(message);
    if (id && conversationId === null) onConversationCreated(id);
  };

  // A suggestion unmounts with the empty state, which would drop keyboard focus on <body>.
  // Not on touch screens, where focusing the textarea would pop the keyboard up.
  const sendSuggestion = (message: string) => {
    if (!window.matchMedia("(pointer: coarse)").matches) inputRef.current?.focus();
    void send(message);
  };

  const retry = async () => {
    scrollToEnd({ behavior: "smooth" });
    const id = await chat.retry();
    if (id && conversationId === null) onConversationCreated(id);
  };

  const streaming = chat.state.status === "streaming";
  const messages = conversation.data?.messages ?? [];
  const loading = viewId !== null && conversation.isPending;
  // A failed refetch keeps the previous data, but a 404 is final: the conversation is
  // gone or not this user's (e.g. the session changed in another tab). Other errors keep
  // showing what was loaded.
  const notFound = conversation.error instanceof ApiError && conversation.error.status === 404;
  const loadError = viewId !== null && conversation.isError && (!conversation.data || notFound);
  const isEmpty = viewId === null && chat.state.status === "idle";

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
    body = <ChatEmptyState userName={user.name} companyName={user.company.name} onPick={sendSuggestion} />;
  } else {
    body = (
      <>
        {messages.map((message, index) => (
          // Messages are append-only and have no id: the index is stable within a conversation.
          <MessageScrollerItem key={`${viewId}-${index}`} messageId={`${viewId}-${index}`}>
            <StoredMessage message={message} onOpenProduct={openProduct} />
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
          {/* aria-live off: the log's implicit live region would read a whole conversation
              out when it loads, and re-announce an answer when it moves into the cache.
              Finished answers are announced once, by the status below. */}
          <MessageScrollerContent aria-live="off" className="mx-auto w-full max-w-3xl px-4 py-6">
            {body}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton
          size={streaming ? "sm" : "icon-sm"}
          aria-label={streaming ? undefined : "Ir para a última mensagem"}
        >
          <ArrowDown aria-hidden />
          {streaming && "Novas mensagens"}
        </MessageScrollerButton>
      </MessageScroller>

      <p role="status" className="sr-only">
        {chat.state.lastReply && `Resposta do assistente: ${chat.state.lastReply}`}
      </p>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3">
        <Composer
          inputRef={inputRef}
          streaming={streaming}
          disabled={loading || loadError}
          onSend={send}
          onStop={chat.stop}
        />
      </div>

      <ProductDetailSheet
        product={detail.product}
        open={detail.open}
        onOpenChange={(open) => setDetail((current) => ({ ...current, open }))}
      />
    </div>
  );
}

function StoredMessage({
  message,
  onOpenProduct,
}: {
  message: ChatMessage;
  onOpenProduct: (product: Product) => void;
}) {
  if (message.role === "user") return <UserMessage content={message.content} />;
  return (
    <AssistantMessage
      text={message.content}
      activity={message.toolCalls && <ToolCallsDisclosure calls={message.toolCalls} />}
    >
      {message.products && <ProductResults products={message.products} onOpen={onOpenProduct} />}
    </AssistantMessage>
  );
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
          <AssistantMessage
            text={state.text}
            streaming={state.status === "streaming"}
            activity={<ToolActivityChips tools={state.tools} />}
            // A running tool already says what is happening.
            thinking={state.status === "streaming" && !state.text && !state.tools.some((t) => t.status === "running")}
          >
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
