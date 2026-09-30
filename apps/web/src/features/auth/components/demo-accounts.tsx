import { Button } from "@multi-tenant-ai-catalog/ui/components/button";

import { RoleBadge } from "@/components/role-badge";

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../demo-accounts";

export function DemoAccounts({
  onSelect,
  disabled,
}: {
  onSelect: (credentials: { email: string; password: string }) => void;
  disabled?: boolean;
}) {
  return (
    <section aria-labelledby="demo-accounts-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="demo-accounts-title" className="text-sm font-medium">
          Contas de demonstração
        </h2>
        <p className="text-xs text-muted-foreground">
          Entre com um clique para comparar empresas e papéis.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-auto w-full flex-col items-start gap-1 py-2 text-left"
              onClick={() => onSelect({ email: account.email, password: DEMO_PASSWORD })}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate font-medium">{account.company}</span>
                <RoleBadge role={account.role} />
              </span>
              <span className="w-full truncate font-normal text-muted-foreground">
                {account.email}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
