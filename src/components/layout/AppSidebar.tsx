import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Camera,
  FileText,
  FileType2,
  Images,
  FolderClock,
  Settings,
  Sparkles,
} from "lucide-react";
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
} from "@/components/ui/sidebar";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pas-foto", label: "Pas Foto", icon: Camera },
  { to: "/pdf-tools", label: "PDF Tools", icon: FileText },
  { to: "/word-tools", label: "Word Tools", icon: FileType2 },
  { to: "/photo-tools", label: "Photo Tools", icon: Images },
  { to: "/riwayat", label: "Riwayat", icon: FolderClock },
  { to: "/akun", label: "Akun", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">ROY DIGITAL</p>
            <p className="truncate text-xs text-sidebar-foreground/70">SOLUTION</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Solusi Digital untuk Foto, Dokumen &amp; Kreativitas
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
