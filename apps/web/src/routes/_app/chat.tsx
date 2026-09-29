import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@multi-tenant-ai-catalog/ui/components/empty";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { RequirePermission } from "@/components/forbidden-state";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat · Catálogo IA" }] }),
  component: () => (
    <RequirePermission permission="chat:use">
      <ChatPage />
    </RequirePermission>
  ),
});

// Placeholder: the agent chat is implemented in a later task.
function ChatPage() {
  return (
    <>
      <PageHeader
        title="Chat"
        description="Pergunte sobre o catálogo. O agente responde com base nos produtos cadastrados."
      />
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquare />
          </EmptyMedia>
          <EmptyTitle>Chat em construção</EmptyTitle>
          <EmptyDescription>O agente de IA chega em uma próxima etapa.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
