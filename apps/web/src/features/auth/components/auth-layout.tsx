import { Bot, Building2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";

const HIGHLIGHTS = [
  {
    icon: Building2,
    title: "Catálogo por empresa",
    description: "Cada empresa vê e gerencia apenas os próprios produtos.",
  },
  {
    icon: Bot,
    title: "Agente de IA com dados reais",
    description: "Respostas baseadas no catálogo cadastrado, sem inventar produtos ou preços.",
  },
  {
    icon: ShieldCheck,
    title: "Controle de acesso por papel",
    description: "Administradores gerenciam o catálogo; usuários consultam e conversam.",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r bg-muted/40 p-10 lg:flex">
        <BrandMark />
        <div className="flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-semibold text-balance">
              Seu catálogo respondendo clientes com precisão.
            </h2>
            <p className="text-muted-foreground">
              Um agente de IA que consulta os produtos da sua empresa em tempo real.
            </p>
          </div>
          <ul className="flex flex-col gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center border bg-background">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Desafio técnico · multi-tenant AI catalog</p>
      </aside>

      <main className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex items-center justify-between lg:justify-end">
          <BrandMark className="lg:hidden" />
          <ModeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
