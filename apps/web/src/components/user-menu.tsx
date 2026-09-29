import { Avatar, AvatarFallback } from "@multi-tenant-ai-catalog/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@multi-tenant-ai-catalog/ui/components/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@multi-tenant-ai-catalog/ui/components/sidebar";
import { ChevronsUpDown, LogOut, Palette } from "lucide-react";

import { RoleBadge } from "@/components/role-badge";
import { ThemeRadioItems } from "@/components/mode-toggle";
import type { AuthUser } from "@/features/auth/api";
import { useLogout } from "@/features/auth/hooks";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function UserIdentity({ user }: { user: AuthUser }) {
  return (
    <>
      <Avatar>
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-muted-foreground">{user.email}</span>
      </div>
    </>
  );
}

export function UserMenu({ user }: { user: AuthUser }) {
  const logout = useLogout();
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" aria-label="Menu do usuário" />}
        className="cursor-pointer"
      >
        <UserIdentity user={user} />
        <ChevronsUpDown className="ml-auto" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-2 text-foreground">
            <span className="flex items-center gap-2">
              <UserIdentity user={user} />
            </span>
            <span>
              <RoleBadge role={user.role} />
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            <ThemeRadioItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
