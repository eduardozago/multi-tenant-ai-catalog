import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@multi-tenant-ai-catalog/ui/components/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Building2, House, type LucideIcon, MessageSquare, Package } from "lucide-react";

import { UserMenu } from "@/components/user-menu";
import type { AuthUser } from "@/features/auth/api";
import { can, type Permission } from "@/lib/permissions";

type NavItem = {
  to: "/" | "/products" | "/chat";
  label: string;
  icon: LucideIcon;
  /** Omitted: visible to every authenticated user. */
  permission?: Permission;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Início", icon: House },
  { to: "/products", label: "Produtos", icon: Package, permission: "products:read" },
  { to: "/chat", label: "Chat", icon: MessageSquare, permission: "chat:use" },
];

export function AppSidebar({ user }: { user: AuthUser }) {
  const matchRoute = useMatchRoute();
  const { setOpenMobile } = useSidebar();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(user.role, item.permission));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-0">
              <div className="flex size-8 shrink-0 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" aria-hidden />
              </div>
              <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">{user.company.name}</span>
                <span className="truncate text-xs text-muted-foreground">Catálogo IA</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    tooltip={label}
                    isActive={!!matchRoute({ to, fuzzy: to !== "/" })}
                    render={<Link to={to} onClick={() => setOpenMobile(false)} />}
                  >
                    <Icon aria-hidden />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
