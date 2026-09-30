import { Button, buttonVariants } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@multi-tenant-ai-catalog/ui/components/sheet";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { History, SquarePen } from "lucide-react";
import { useState } from "react";

import { RequirePermission } from "@/components/forbidden-state";
import { ChatView } from "@/features/chat/components/chat-view";
import { ConversationList } from "@/features/chat/components/conversation-list";
import { useConversation } from "@/features/chat/hooks";
import { chatSearchSchema } from "@/features/chat/schemas";

export const Route = createFileRoute("/_app/chat")({
  // The open conversation lives in the URL (?c=<id>): refresh and back/forward keep it.
  validateSearch: chatSearchSchema,
  head: () => ({ meta: [{ title: "Chat · Catálogo IA" }] }),
  component: () => (
    <RequirePermission permission="chat:use">
      <ChatPage />
    </RequirePermission>
  ),
});

function ChatPage() {
  const { c: conversationId = null } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [historyOpen, setHistoryOpen] = useState(false);
  // Shares the ChatView query (same key), so this adds no request.
  const title = useConversation(conversationId).data?.title;

  return (
    // The chat owns its height, unlike other pages that grow with the document: the
    // message list scrolls inside and the composer stays at the bottom. The negative
    // margin cancels the layout's padding (p-4 md:p-6) and 3rem is the app header, so
    // the page is exactly one viewport tall. dvh (not vh) shrinks with the mobile
    // browser bars and, with interactive-widget=resizes-content, with the keyboard.
    <div className="-m-4 flex h-[calc(100dvh-3rem)] min-h-0 md:-m-6">
      {/* History as a column from lg; below that, the same list in a Sheet. */}
      <aside className="hidden w-72 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-11 shrink-0 items-center border-b px-4">
          <h2 className="text-sm font-medium">Conversas</h2>
        </div>
        <ConversationList activeId={conversationId} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-2 lg:px-4">
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Histórico de conversas" />}
            >
              <History aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" className="w-full max-w-xs gap-0 p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Conversas</SheetTitle>
                <SheetDescription className="sr-only">Abra uma conversa anterior ou comece uma nova.</SheetDescription>
              </SheetHeader>
              <ConversationList activeId={conversationId} onNavigate={() => setHistoryOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 truncate text-base font-semibold">
            Chat
            {title && <span className="font-normal text-muted-foreground"> · {title}</span>}
          </h1>
          {conversationId && (
            // lg+ has the same action at the top of the history column.
            <Link
              to="/chat"
              search={{}}
              aria-label="Nova conversa"
              className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "ml-auto lg:hidden" })}
            >
              <SquarePen aria-hidden />
            </Link>
          )}
        </div>

        <ChatView
          conversationId={conversationId}
          // replace: Back from the new conversation should not return to its empty draft.
          onConversationCreated={(id) => navigate({ search: { c: id }, replace: true })}
          onNewConversation={() => navigate({ search: {} })}
        />
      </div>
    </div>
  );
}
