import { Alert, AlertAction, AlertDescription } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Bubble, BubbleContent } from "@multi-tenant-ai-catalog/ui/components/bubble";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { Message, MessageAvatar, MessageContent } from "@multi-tenant-ai-catalog/ui/components/message";
import { AlertCircle, RotateCcw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { getChatErrorMessage, isRetryable } from "../errors";
import { Markdown } from "./markdown";

export function UserMessage({ content }: { content: string }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end">
          {/* Plain text on purpose: the user's own message is never rendered as markdown. */}
          <BubbleContent className="text-sm whitespace-pre-wrap">{content}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/**
 * The assistant's side of an exchange: avatar, answer and whatever goes with it
 * (`children`: notices now, tool activity and product cards later).
 *
 * aria-live="polite" with aria-busy while streaming: screen readers wait for the complete
 * answer instead of reading every chunk as it arrives.
 */
export function AssistantMessage({
  text,
  streaming = false,
  children,
}: {
  text: string;
  streaming?: boolean;
  children?: ReactNode;
}) {
  return (
    <Message align="start" aria-live="polite" aria-busy={streaming}>
      <MessageAvatar className="size-8 self-start text-muted-foreground">
        <Sparkles className="size-4" aria-hidden />
      </MessageAvatar>
      <MessageContent className="gap-3 pt-1">
        <span className="sr-only">Assistente:</span>
        {text ? (
          <Markdown streaming={streaming}>{text}</Markdown>
        ) : (
          streaming && <p className="text-sm text-muted-foreground motion-safe:animate-pulse">Pensando…</p>
        )}
        {children}
      </MessageContent>
    </Message>
  );
}

/** Shown in the assistant's place when the answer failed; nothing was stored (D-29). */
export function ChatErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Message align="start">
      <MessageAvatar className="size-8 self-start text-destructive">
        <AlertCircle className="size-4" aria-hidden />
      </MessageAvatar>
      <MessageContent>
        <Alert variant="destructive" role="alert">
          <AlertDescription>{getChatErrorMessage(error)}</AlertDescription>
          {isRetryable(error) && (
            <AlertAction>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw aria-hidden />
                Tentar novamente
              </Button>
            </AlertAction>
          )}
        </Alert>
      </MessageContent>
    </Message>
  );
}

/** Under an answer the user stopped. The partial text stays visible but is not stored. */
export function StoppedNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Resposta interrompida.</span>
      <Button variant="ghost" size="xs" onClick={onRetry}>
        <RotateCcw aria-hidden />
        Reenviar
      </Button>
    </div>
  );
}
