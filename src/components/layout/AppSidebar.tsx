import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Camera,
  FileText,
  FileType2,
  Images,
  FolderClock,
  Settings,
  Wand2,
  Sparkles,
  LogOut,
  ChevronsUpDown,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const NAV_GROUPS = [
  {
    label: "Utama",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Foto",
    items: [
      { to: "/pas-foto", label: "Pas Foto", icon: Camera },
      { to: "/photo-tools", label: "Photo Tools", icon: Images },
      { to: "/ai-tools", label: "AI Tools", icon: Wand2 },
    ],
  },
  {
    label: "Dokumen",
    items: [
      { to: "/pdf-tools", label: "PDF Tools", icon: FileText },
      { to: "/word-tools", label: "Word Tools", icon: FileType2 },
    ],
  },
  {
    label: "Arsip",
    items: [{ to: "/riwayat", label: "Riwayat", icon: FolderClock }],
  },
] as const;

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items).concat([
  { to: "/akun", label: "Akun", icon: Settings },
] as never);

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "RD";

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal keluar. Silakan coba lagi.");
      return;
    }
    toast.success("Anda telah keluar.");
    navigate({ to: "/auth" });
  }

  return (
    <Sidebar collapsible="icon" className="transition-[width] duration-300 ease-in-out">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">ROY DIGITAL</p>
            <p className="truncate text-xs text-sidebar-foreground/70">SOLUTION</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label}>
            {index > 0 ? (
              <SidebarSeparator className="my-1 group-data-[collapsible=icon]:mx-auto" />
            ) : null}
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.to}
                        tooltip={item.label}
                        className="transition-colors duration-200 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={email || "Akun"}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {email ? email.split("@")[0] : "Pengguna"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {email || "Belum masuk"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/akun">
                    <Settings className="size-4" /> Pengaturan Akun
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
