import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Settings, Users, ChartBar as BarChart3, Save, Loader as Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/pengaturan-website")({
  ssr: false,
  beforeLoad: async ({ server }) => {
    if (server) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw redirect({ to: "/auth" });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== "owner") throw redirect({ to: "/dashboard" });
    return { userId: authData.user.id };
  },
  head: () => ({
    meta: [
      { title: "Pengaturan Website — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Kelola pengaturan website, lihat daftar pengguna, dan statistik penggunaan.",
      },
    ],
  }),
  component: PengaturanWebsitePage,
});

type SiteSettings = {
  site_name: string;
  site_address: string;
  site_tagline: string;
};

type UserRow = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  tier: string;
};

type Tier = "trial" | "regular" | "premium";

const TIER_LABELS: Record<Tier, string> = {
  trial: "Trial",
  regular: "Reguler",
  premium: "Premium",
};

type ToolStat = { tool: string; count: number };

function PengaturanWebsitePage() {
  const { userId } = Route.useRouteContext();
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "",
    site_address: "",
    site_tagline: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [toolStats, setToolStats] = useState<ToolStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, site_address, site_tagline")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      toast.error("Gagal memuat pengaturan website.");
    } else if (data) {
      setSettings(data);
    }
    setLoadingSettings(false);
  }

  async function saveSettings() {
    setSavingSettings(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: settings.site_name,
        site_address: settings.site_address,
        site_tagline: settings.site_tagline,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", true);
    setSavingSettings(false);
    if (error) {
      toast.error("Gagal menyimpan pengaturan.");
    } else {
      toast.success("Pengaturan website berhasil disimpan.");
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc("get_all_users");
    if (error) {
      toast.error("Gagal memuat daftar pengguna.");
    } else if (data) {
      setUsers(data as UserRow[]);
    }
    setLoadingUsers(false);
  }

  async function changeTier(userId: string, newTier: Tier) {
    const { error } = await supabase
      .from("profiles")
      .update({ tier: newTier, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      toast.error("Gagal mengubah tier pengguna.");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, tier: newTier } : u)),
    );
    toast.success(`Tier berhasil diubah ke ${TIER_LABELS[newTier]}.`);
  }

  async function loadStats() {
    setLoadingStats(true);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .gte("created_at", firstOfMonth);
    setTotalThisMonth(count ?? 0);

    const { data: toolData } = await supabase
      .from("projects")
      .select("tool")
      .gte("created_at", firstOfMonth);
    if (toolData) {
      const counts: Record<string, number> = {};
      for (const row of toolData) {
        const t = row.tool ?? "lainnya";
        counts[t] = (counts[t] ?? 0) + 1;
      }
      const sorted = Object.entries(counts)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count);
      setToolStats(sorted);
    }
    setLoadingStats(false);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "Belum pernah";
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Pengaturan Website"
        description="Kelola informasi website, lihat pengguna, dan pantau statistik penggunaan."
        icon={Settings}
      >
        <Badge variant="secondary" className="gap-1">
          <Shield className="size-3" /> Owner
        </Badge>
      </PageHeader>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4 text-primary" /> Informasi Website
          </CardTitle>
          <CardDescription>
            Nama, alamat, dan tagline yang ditampilkan di seluruh aplikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSettings ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="site_name">Nama Website</Label>
                <Input
                  id="site_name"
                  value={settings.site_name}
                  onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site_address">Alamat</Label>
                <Input
                  id="site_address"
                  value={settings.site_address}
                  onChange={(e) => setSettings({ ...settings, site_address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site_tagline">Tagline / Kalimat Website</Label>
                <Input
                  id="site_tagline"
                  value={settings.site_tagline}
                  onChange={(e) => setSettings({ ...settings, site_tagline: e.target.value })}
                />
              </div>
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Simpan Perubahan
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" /> Statistik Bulan Ini
          </CardTitle>
          <CardDescription>Ringkasan aktivitas penggunaan bulan ini.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Total Konversi</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{totalThisMonth}</p>
                <p className="mt-1 text-xs text-muted-foreground">Bulan ini</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Fitur Paling Sering Dipakai</p>
                {toolStats.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Belum ada aktivitas bulan ini.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {toolStats.slice(0, 5).map((s) => (
                      <div key={s.tool} className="flex items-center gap-3">
                        <span className="flex-1 truncate text-sm font-medium">{s.tool}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/15">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${toolStats[0] ? (s.count / toolStats[0].count) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm tabular-nums text-muted-foreground">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" /> Daftar Pengguna
          </CardTitle>
          <CardDescription>
            Semua pengguna terdaftar, kapan mendaftar, dan login terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada pengguna terdaftar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Bergabung</TableHead>
                    <TableHead>Login Terakhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const currentTier = (u.tier as Tier) || "trial";
                    const isOwner = u.role === "owner";
                    return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={isOwner ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Select
                                value={currentTier}
                                onValueChange={(v) => changeTier(u.user_id, v as Tier)}
                                disabled={isOwner}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="trial">Trial</SelectItem>
                                  <SelectItem value="regular">Reguler</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                </SelectContent>
                              </Select>
                            </TooltipTrigger>
                            {isOwner && (
                              <TooltipContent>
                                Tier owner tidak dapat diubah
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.last_sign_in_at)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
