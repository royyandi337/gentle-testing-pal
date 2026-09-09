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
  FileEdit,
  Crown,
  QrCode,
  Megaphone,
  ShieldCheck,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditIndicator } from "@/components/shared/CreditIndicator";
import { AdSlot } from "@/components/shared/AdSlot";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCredits, type Tier } from "@/hooks/useCredits";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getEffectiveRole,
  shouldShowAdSlot,
  shouldShowUpgradeCTA,
  canManageSite,
  isAdvertiser as isAdvertiserRole,
  type EffectiveRole,
  type AppRole,
} from "@/lib/permissions";

export const NAV_GROUPS = [
  { label: "Utama", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
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
      { to: "/templat-surat", label: "Templat Surat", icon: FileEdit },
      { to: "/qr-code", label: "QR Code", icon: QrCode },
    ],
  },
  { label: "Arsip", items: [{ to: "/riwayat", label: "Riwayat", icon: FolderClock }] },
] as const;

type SidebarAccount = {
  role: AppRole;
  avatarUrl: string | null;
  trialExpiresAt: string | null;
  loading: boolean;
};

function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

function AccountStatusCard({
  tier,
  role,
  trialExpiresAt,
  loading,
}: {
  tier: Tier;
  role: AppRole;
  trialExpiresAt: string | null;
  loading: boolean;
}) {
  const effective = getEffectiveRole(role, tier);
  if (loading) {
    return <Skeleton className="mx-2 mb-2 h-[76px] rounded-xl bg-white/10" />;
  }

  if (effective === "owner") {
    return (
      <div className="mx-2 mb-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-accent">
          <ShieldCheck className="size-4" />
          <span className="text-[12.5px] font-semibold">Owner Web</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">Akses sistem penuh tanpa iklan.</p>
      </div>
    );
  }

  if (effective === "advertiser") {
    return (
      <div className="mx-2 mb-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sky-300">
          <Megaphone className="size-4" />
          <span className="text-[12.5px] font-semibold">Akun Iklan</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">Kelola kampanye dari menu akun Anda.</p>
      </div>
    );
  }

  if (tier === "premium") {
    return (
      <div className="mx-2 mb-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-accent">
          <Crown className="size-4" />
          <span className="text-[12.5px] font-semibold">PRO / Premium</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">AI tanpa batas dan bebas iklan.</p>
      </div>
    );
  }

  if (tier === "trial") {
    const days = daysRemaining(trialExpiresAt);
    return (
      <div className="mx-2 mb-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sky-300">
          <Sparkles className="size-4" />
          <span className="text-[12.5px] font-semibold">Masa Trial</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">
          {days === null ? "Nikmati akses trial Anda." : days === 0 ? "Trial berakhir hari ini." : `${days} hari trial tersisa.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5">
      <div className="flex items-center gap-2 text-white">
        <Crown className="size-4 text-accent" />
        <span className="text-[12.5px] font-semibold">Paket Reguler</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">Upgrade ke Premium untuk menghapus iklan.</p>
      <Link to="/akun" className="mt-2 inline-flex text-[11px] font-semibold text-accent hover:underline">Upgrade ke Premium</Link>
    </div>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();
  const { tier, loading: creditsLoading } = useCredits();
  const [account, setAccount] = useState<SidebarAccount>({
    role: "user",
    avatarUrl: null,
    trialExpiresAt: null,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setAccount({ role: "user", avatarUrl: null, trialExpiresAt: null, loading: false });
      return;
    }
    let active = true;

    async function loadAccount() {
      const { data, error } = await supabase.rpc("get_sidebar_user_data").maybeSingle();
      if (!active) return;
      if (error || !data) {
        setAccount((current) => ({ ...current, loading: false }));
        return;
      }
      const nextRole = data.role;
      setAccount({
        role: nextRole === "owner" || nextRole === "admin" || nextRole === "advertiser" ? nextRole : "user",
        avatarUrl: data.avatar_url ?? null,
        trialExpiresAt: data.trial_expires_at ?? null,
        loading: false,
      });
    }

    void loadAccount();
    const channel = supabase
      .channel(`sidebar-account-${user.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => void loadAccount())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => void loadAccount())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const effectiveRole = getEffectiveRole(account.role, tier);
  const isOwner = canManageSite(effectiveRole);
  const isAdvertiser = isAdvertiserRole(effectiveRole);
  const accountLoading = authLoading || account.loading || creditsLoading;
  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "RD";

  const ownerNav = useMemo(
    () => ({ label: "Sistem", items: [{ to: "/pengaturan-website", label: "Pengaturan Website", icon: Settings }] }),
    [],
  );

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
      <SidebarHeader className="shrink-0 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]", settings.logo_data_url ? "bg-white/5 p-0.5" : "bg-white/10")}>
            {settings.logo_data_url ? <img src={settings.logo_data_url} alt={settings.site_name_main || "Logo"} className="h-full w-full object-contain" /> : <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" className="size-4"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M3 7l9 5 9-5" /><path d="M12 22V12" /></svg>}
          </div>
          <div className="min-w-0 flex-1 font-display transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13.5px] font-bold leading-tight text-white">{settings.site_name_main || "ROY DIGITAL"}</p>
            <p className="truncate text-[9.5px] text-sidebar-foreground/55">{settings.site_name_sub || "SOLUTION"}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-1 overflow-y-auto overscroll-contain">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label}>
            {index > 0 ? <SidebarSeparator className="my-1 group-data-[collapsible=icon]:mx-auto" /> : null}
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/55">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent><SidebarMenu>{group.items.map((item) => <SidebarMenuItem key={item.to}><SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label} className="transition-colors duration-200 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"><Link to={item.to}><item.icon /><span className="truncate">{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
        {isOwner ? <div><SidebarSeparator className="my-1 group-data-[collapsible=icon]:mx-auto" /><SidebarGroup className="py-1"><SidebarGroupLabel className="text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/55">{ownerNav.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{ownerNav.items.map((item) => <SidebarMenuItem key={item.to}><SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label} className="transition-colors duration-200 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"><Link to={item.to}><item.icon /><span className="truncate">{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></div> : null}
        {isAdvertiser ? <div><SidebarSeparator className="my-1 group-data-[collapsible=icon]:mx-auto" /><SidebarGroup className="py-1"><SidebarGroupLabel className="text-[0.68rem] font-medium uppercase tracking-wider text-sidebar-foreground/55">Iklan Anda</SidebarGroupLabel><SidebarGroupContent><div className="px-2 text-[11px] leading-relaxed text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">Campaign Manager dan Billing belum tersedia pada aplikasi ini.</div></SidebarGroupContent></SidebarGroup></div> : null}
      </SidebarContent>

      <div className="shrink-0 space-y-2 border-t border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:hidden">
        <CreditIndicator />
        <div className="min-h-40">{shouldShowAdSlot(effectiveRole) ? <AdSlot variant="sidebar" /> : null}</div>
      </div>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border">
        <AccountStatusCard tier={tier} role={account.role} trialExpiresAt={account.trialExpiresAt} loading={accountLoading} />
        {shouldShowUpgradeCTA(effectiveRole) ? <Link to="/akun" className="mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 group-data-[collapsible=icon]:hidden"><Crown className="size-3.5" /> Upgrade</Link> : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><SidebarMenuButton size="lg" tooltip={email || "Akun"} className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"><Avatar className="size-8 rounded-lg">{account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="Foto profil" /> : null}<AvatarFallback className="rounded-lg bg-sidebar-primary text-xs text-sidebar-primary-foreground">{initials}</AvatarFallback></Avatar><div className="grid min-w-0 flex-1 text-left leading-tight"><span className="truncate text-sm font-medium">{email ? email.split("@")[0] : "Pengguna"}</span><span className="truncate text-xs text-sidebar-foreground/70">{email}</span></div><ChevronsUpDown className="ml-auto size-4 opacity-60" /></SidebarMenuButton></DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56"><DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email || "Belum masuk"}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/akun"><Settings className="size-4" /> Pengaturan Akun</Link></DropdownMenuItem><DropdownMenuItem onClick={signOut}><LogOut className="size-4" /> Keluar</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
