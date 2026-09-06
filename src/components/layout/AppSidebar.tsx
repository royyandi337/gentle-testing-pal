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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditIndicator } from "@/components/shared/CreditIndicator";
import { AdSlot } from "@/components/shared/AdSlot";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCredits } from "@/hooks/useCredits";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

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


export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "RD";

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setAvatarUrl(data?.avatar_url ?? null);
      });
    return () => {
      active = false;
    };
  }, [user]);

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
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" className="size-4">
              <path d="M12 2 3 7v10l9 5 9-5V7z" />
              <path d="M3 7l9 5 9-5" />
              <path d="M12 22V12" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 font-display transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13.5px] font-bold leading-tight text-white">
              {settings.site_name.split(" ").slice(0, 2).join(" ") || "ROY DIGITAL"}
            </p>
            <p className="truncate text-[9.5px] text-sidebar-foreground/55">
              {settings.site_name.split(" ").slice(2).join(" ") || "SOLUTION"}
            </p>
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

      <div className="space-y-2 px-2 pb-2 group-data-[collapsible=icon]:hidden">
        <CreditIndicator />
        {tier === "premium" || remaining === -1 ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent">
            <Crown className="size-3" /> Premium — tak terbatas
          </div>
        ) : null}
        <AdSlot variant="sidebar" />
      </div>

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
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="Foto profil" /> : null}
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
