import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Settings,
  Users,
  ChartBar as BarChart3,
  Save,
  Loader2,
  Shield,
  Image as ImageIcon,
  Palette,
  CreditCard,
  Globe,
  Upload,
  Trash2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pengaturan-website")({
  ssr: false,
  beforeLoad: async () => {
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
  site_name_main: string;
  site_name_sub: string;
  site_address: string;
  site_tagline: string;
  logo_data_url: string | null;
  payment_mode: "otomatis" | "manual";
  payment_gateway: string;
  manual_payment_info: string;
  accent_color: string;
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

const ACCENT_PRESETS = [
  { name: "Gold", value: "#C79A46" },
  { name: "Emerald", value: "#10B981" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Teal", value: "#14B8A6" },
];

const GATEWAYS = ["Midtrans", "Xendit", "Doku", "Manual Transfer"];

function PengaturanWebsitePage() {
  const { userId } = Route.useRouteContext() as { userId: string };
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "",
    site_name_main: "ROY DIGITAL",
    site_name_sub: "SOLUTION",
    site_address: "",
    site_tagline: "",
    logo_data_url: null,
    payment_mode: "otomatis",
    payment_gateway: "Midtrans",
    manual_payment_info: "",
    accent_color: "#C79A46",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [toolStats, setToolStats] = useState<ToolStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .select(
        "site_name, site_name_main, site_name_sub, site_address, site_tagline, logo_data_url, payment_mode, payment_gateway, manual_payment_info, accent_color",
      )
      .eq("id", true)
      .maybeSingle();
    if (error) {
      toast.error("Gagal memuat pengaturan website.");
    } else if (data) {
      setSettings({
        site_name: data.site_name || "",
        site_name_main: data.site_name_main || "ROY DIGITAL",
        site_name_sub: data.site_name_sub || "SOLUTION",
        site_address: data.site_address || "",
        site_tagline: data.site_tagline || "",
        logo_data_url: data.logo_data_url || null,
        payment_mode: data.payment_mode === "manual" ? "manual" : "otomatis",
        payment_gateway: data.payment_gateway || "Midtrans",
        manual_payment_info: data.manual_payment_info || "",
        accent_color: data.accent_color || "#C79A46",
      });
    }
    setLoadingSettings(false);
  }

  async function saveSettings() {
    setSavingSettings(true);
    const fullName = `${settings.site_name_main} ${settings.site_name_sub}`.trim();
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: fullName,
        site_name_main: settings.site_name_main,
        site_name_sub: settings.site_name_sub,
        site_address: settings.site_address,
        site_tagline: settings.site_tagline,
        logo_data_url: settings.logo_data_url,
        payment_mode: settings.payment_mode,
        payment_gateway: settings.payment_gateway,
        manual_payment_info: settings.manual_payment_info,
        accent_color: settings.accent_color,
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.");
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error("Ukuran logo maksimal 512KB.");
      return;
    }

    setLogoUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Gagal membaca file."));
        reader.readAsDataURL(file);
      });
      setSettings((prev) => ({ ...prev, logo_data_url: dataUrl }));
      toast.success("Logo dimuat. Klik Simpan untuk menyimpan.");
    } catch {
      toast.error("Gagal memuat logo.");
    } finally {
      setLogoUploading(false);
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

  async function changeTier(targetUserId: string, newTier: Tier) {
    const { error } = await supabase
      .from("profiles")
      .update({ tier: newTier, updated_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (error) {
      toast.error("Gagal mengubah tier pengguna.");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.user_id === targetUserId ? { ...u, tier: newTier } : u)),
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
        description="Kelola identitas, tampilan, pembayaran, pengguna, dan statistik website."
        icon={Settings}
      >
        <Badge variant="secondary" className="gap-1">
          <Shield className="size-3" /> Owner
        </Badge>
      </PageHeader>

      <Tabs defaultValue="identitas" className="w-full">
        <TabsList className="mb-5 grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="identitas" className="gap-1.5">
            <Globe className="size-3.5" /> Identitas
          </TabsTrigger>
          <TabsTrigger value="tampilan" className="gap-1.5">
            <Palette className="size-3.5" /> Tampilan
          </TabsTrigger>
          <TabsTrigger value="pembayaran" className="gap-1.5">
            <CreditCard className="size-3.5" /> Pembayaran
          </TabsTrigger>
          <TabsTrigger value="pengguna" className="gap-1.5">
            <Users className="size-3.5" /> Pengguna
          </TabsTrigger>
          <TabsTrigger value="statistik" className="gap-1.5">
            <BarChart3 className="size-3.5" /> Statistik
          </TabsTrigger>
        </TabsList>

        {/* ===== IDENTITAS ===== */}
        <TabsContent value="identitas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4 text-primary" /> Identitas Website
              </CardTitle>
              <CardDescription>
                Nama, alamat, dan tagline yang ditampilkan di seluruh aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingSettings ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="site_name_main">Nama Utama</Label>
                      <Input
                        id="site_name_main"
                        value={settings.site_name_main}
                        onChange={(e) =>
                          setSettings({ ...settings, site_name_main: e.target.value })
                        }
                        placeholder="ROY DIGITAL"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="site_name_sub">Nama Sub</Label>
                      <Input
                        id="site_name_sub"
                        value={settings.site_name_sub}
                        onChange={(e) =>
                          setSettings({ ...settings, site_name_sub: e.target.value })
                        }
                        placeholder="SOLUTION"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="site_address">Alamat</Label>
                    <Input
                      id="site_address"
                      value={settings.site_address}
                      onChange={(e) =>
                        setSettings({ ...settings, site_address: e.target.value })
                      }
                      placeholder="Jl. Contoh No. 10, Bogor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="site_tagline">Tagline / Kalimat Website</Label>
                    <Textarea
                      id="site_tagline"
                      value={settings.site_tagline}
                      onChange={(e) =>
                        setSettings({ ...settings, site_tagline: e.target.value })
                      }
                      placeholder="Solusi digital untuk foto, dokumen, dan kebutuhan kreatif Anda."
                      rows={2}
                    />
                  </div>
                  <SaveButton onClick={saveSettings} saving={savingSettings} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAMPILAN ===== */}
        <TabsContent value="tampilan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-primary" /> Tampilan & Logo
              </CardTitle>
              <CardDescription>
                Unggah logo dan pilih warna aksen untuk identitas visual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingSettings ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  {/* Logo upload */}
                  <div className="space-y-1.5">
                    <Label>Logo Website</Label>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30">
                        {logoUploading ? (
                          <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        ) : settings.logo_data_url ? (
                          <img
                            src={settings.logo_data_url}
                            alt="Logo"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={logoUploading}
                        >
                          <Upload className="size-4" /> Unggah Logo
                        </Button>
                        {settings.logo_data_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSettings({ ...settings, logo_data_url: null })
                            }
                          >
                            <Trash2 className="size-4" /> Hapus
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG/JPG, maksimal 512KB. Disimpan sebagai data URL.
                      </p>
                    </div>
                  </div>

                  {/* Accent color */}
                  <div className="space-y-1.5">
                    <Label>Warna Aksen</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() =>
                            setSettings({ ...settings, accent_color: preset.value })
                          }
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                            settings.accent_color === preset.value
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-foreground/30",
                          )}
                        >
                          <span
                            className="size-4 rounded-full"
                            style={{ backgroundColor: preset.value }}
                          />
                          {preset.name}
                          {settings.accent_color === preset.value && (
                            <Check className="size-3 text-primary" />
                          )}
                        </button>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.accent_color}
                          onChange={(e) =>
                            setSettings({ ...settings, accent_color: e.target.value })
                          }
                          className="size-9 cursor-pointer rounded-lg border border-border"
                        />
                        <Input
                          value={settings.accent_color}
                          onChange={(e) =>
                            setSettings({ ...settings, accent_color: e.target.value })
                          }
                          className="w-24 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <SaveButton onClick={saveSettings} saving={savingSettings} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PEMBAYARAN ===== */}
        <TabsContent value="pembayaran">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" /> Pengaturan Pembayaran
              </CardTitle>
              <CardDescription>
                Pilih mode upgrade dan gateway pembayaran untuk pengguna.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingSettings ? (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-semibold">Mode Upgrade Otomatis</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Jika aktif, pengguna dapat upgrade paket langsung melalui gateway.
                        Jika nonaktif, upgrade dilakukan manual oleh owner.
                      </p>
                    </div>
                    <Switch
                      checked={settings.payment_mode === "otomatis"}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          payment_mode: checked ? "otomatis" : "manual",
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Gateway Pembayaran</Label>
                    <Select
                      value={settings.payment_gateway}
                      onValueChange={(v) =>
                        setSettings({ ...settings, payment_gateway: v })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GATEWAYS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Kredensial gateway disimpan di konfigurasi server yang aman, bukan di sini.
                    </p>
                  </div>

                  {settings.payment_mode === "manual" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="manual_payment_info">
                        Instruksi Pembayaran Manual
                      </Label>
                      <Textarea
                        id="manual_payment_info"
                        value={settings.manual_payment_info}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            manual_payment_info: e.target.value,
                          })
                        }
                        placeholder={"Transfer ke:\nBank BCA\nNo. Rek: 1234567890\nAtas nama: ROY DIGITAL"}
                        rows={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        Teks ini ditampilkan kepada pengguna saat mereka memilih upgrade manual.
                      </p>
                    </div>
                  )}

                  <SaveButton onClick={saveSettings} saving={savingSettings} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PENGGUNA ===== */}
        <TabsContent value="pengguna">
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
                                      onValueChange={(v) =>
                                        changeTier(u.user_id, v as Tier)
                                      }
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
        </TabsContent>

        {/* ===== STATISTIK ===== */}
        <TabsContent value="statistik">
          <Card>
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
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {totalThisMonth}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Bulan ini</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Fitur Paling Sering Dipakai
                    </p>
                    {toolStats.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Belum ada aktivitas bulan ini.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {toolStats.slice(0, 5).map((s) => (
                          <div key={s.tool} className="flex items-center gap-3">
                            <span className="flex-1 truncate text-sm font-medium">
                              {s.tool}
                            </span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button onClick={onClick} disabled={saving}>
      {saving ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Save className="size-4" />
      )}
      Simpan Perubahan
    </Button>
  );
}

export default PengaturanWebsitePage;
