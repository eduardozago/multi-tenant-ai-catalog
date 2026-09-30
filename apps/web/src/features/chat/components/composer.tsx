import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import { Textarea } from "@multi-tenant-ai-catalog/ui/components/textarea";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { ArrowUp, Square } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type RefObject, useId, useLayoutEffect, useRef, useState } from "react";

import { MAX_MESSAGE_LENGTH } from "../api";

/** The counter appears from here on, so it does not distract in normal messages. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;

// `field-sizing: content` grows the textarea with its text in CSS alone; browsers without
// it (older Safari) get the same result from the scrollHeight fallback below.
const supportsFieldSizing = typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

/**
 * Message input. Enter sends, Shift+Enter breaks the line. While an answer streams the
 * text stays editable (so the next question can be typed and the mobile keyboard does
 * not close), but sending is blocked and the button becomes Stop.
 */
export function Composer({
  streaming,
  disabled = false,
  onSend,
  onStop,
  inputRef,
}: {
  streaming: boolean;
  /** No conversation to send to (loading, not found). */
  disabled?: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  /** The textarea, for callers that move focus to it. */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [value, setValue] = useState("");
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? ownRef;
  const hintId = useId();
  const counterId = useId();

  const message = value.trim();
  const canSend = message.length > 0 && !streaming && !disabled;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (supportsFieldSizing || !textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value, textareaRef]);

  const submit = () => {
    if (!canSend) return;
    onSend(message);
    setValue("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: Enter confirms an IME composition (accents on some keyboards, CJK),
    // it must not send a half-typed message.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const showCounter = value.length >= COUNTER_FROM;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2 border bg-background p-2 focus-within:border-ring dark:bg-input/30">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          // Hard limit: typing or pasting past it is cut by the browser, like the server's rule.
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          placeholder="Pergunte sobre produtos, preços, categorias…"
          aria-label="Mensagem"
          aria-describedby={showCounter ? `${hintId} ${counterId}` : hintId}
          enterKeyHint="send"
          // 16px on phones: iOS zooms into any focused field with a smaller font.
          className="max-h-40 min-h-9 overflow-y-auto border-0 bg-transparent px-1.5 py-1.5 text-base shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
        />
        {/* One element for Send and Stop, and aria-disabled instead of disabled: a button
            that unmounts or becomes disabled drops keyboard focus on <body>, which would
            happen on Stop and whenever an answer finishes. submit() does the blocking. */}
        <Button
          type={streaming ? "button" : "submit"}
          variant={streaming ? "outline" : "default"}
          size="icon"
          onClick={streaming ? onStop : undefined}
          aria-disabled={!streaming && !canSend}
          aria-label={streaming ? "Parar resposta" : "Enviar mensagem"}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {streaming ? <Square className="fill-current" aria-hidden /> : <ArrowUp aria-hidden />}
        </Button>
      </div>
      <div className="flex min-h-4 items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span id={hintId} className="max-md:sr-only">
          Enter para enviar, Shift+Enter para quebrar a linha
        </span>
        {showCounter && (
          <span
            id={counterId}
            className={cn("ml-auto tabular-nums", value.length >= MAX_MESSAGE_LENGTH && "text-destructive")}
          >
            {value.length.toLocaleString("pt-BR")}/{MAX_MESSAGE_LENGTH.toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </form>
  );
}
