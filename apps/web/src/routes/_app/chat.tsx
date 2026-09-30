import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { RequirePermission } from "@/components/forbidden-state";
import { ChatView } from "@/features/chat/components/chat-view";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat · Catálogo IA" }] }),
  component: () => (
    <RequirePermission permission="chat:use">
      <ChatPage />
    </RequirePermission>
  ),
});

function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    // The chat owns its height, unlike other pages that grow with the document: the
    // message list scrolls inside and the composer stays at the bottom. The negative
    // margin cancels the layout's padding (p-4 md:p-6) and 3rem is the app header, so
    // the page is exactly one viewport tall. dvh (not vh) shrinks with the mobile
    // browser bars and, with interactive-widget=resizes-content, with the keyboard.
    <div className="-m-4 flex h-[calc(100dvh-3rem)] min-h-0 flex-col md:-m-6">
      <div className="flex h-11 shrink-0 items-center border-b px-4">
        <h1 className="text-base font-semibold">Chat</h1>
      </div>
      <ChatView
        conversationId={conversationId}
        onConversationCreated={setConversationId}
        onNewConversation={() => setConversationId(null)}
      />
    </div>
  );
}
