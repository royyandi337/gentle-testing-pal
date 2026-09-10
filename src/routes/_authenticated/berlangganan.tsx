import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CreditCard,
  Crown,
  Check,
  Upload,
  Loader2,
  Clock,
  XCircle,
  CheckCircle2,
  Receipt,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/berlangganan")({
  head: () => ({
    meta: [
      { title: "Berlangganan — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Upgrade ke paket Premium dan nikmati semua fitur tanpa batas.",
      },
    ],
  }),
  component: BerlanggananPage,
});

type PlanKey = "weekly" | "monthly" | "yearly";

type PlanInfo = {
  key: PlanKey;
  label: string;
  duration: string;
  price: number;
  enabled: boolean;
  features: string[];
};

type Subscription = {
  id: string;
  plan: string;
  amount: number;
  status: string;
  payment_proof_path: string | null;
  notes: string | null;
  admin_notes: string | null;
  premium_expires_at: string | null;
  created_at: string;
  approved_at: string | null;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function BerlanggananPage() {
  const { user } = useAuth();
  const settings = useSiteSettings();
  const { tier } = useCredits();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const plans: PlanInfo[] = [
    {
      key: "weekly",
      label: "Mingguan",
      duration: "7 hari",
      price: settings.price_weekly,
      enabled: settings.price_weekly_enabled,
      features: ["Akses semua fitur AI", "Tanpa iklan", "100 AI per hari"],
    },
    {
      key: "monthly",
      label: "Bulanan",
      duration: "30 hari",
      price: settings.price_monthly,
      enabled: settings.price_monthly_enabled,
      features: ["Akses semua fitur AI tanpa batas", "Tanpa iklan", "Prioritas dukungan"],
    },
    {
      key: "yearly",
      label: "Tahunan",
      duration: "365 hari",
      price: settings.price_yearly,
      enabled: settings.price_yearly_enabled,
      features: ["Akses semua fitur AI tanpa batas", "Tanpa iklan", "Hemat lebih banyak", "Prioritas dukungan"],
    },
  ];

  const activePlans = plans.filter((p) => p.enabled && p.price > 0);

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, plan, amount, status, payment_proof_path, notes, admin_notes, premium_expires_at, created_at, approved_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      toast.error("Gagal memuat riwayat berlangganan.");
      setLoadingHistory(false);
      return;
    }

    const rows = (data ?? []) as Subscription[];
    setSubscriptions(rows);

    const urlMap: Record<string, string> = {};
    for (const row of rows) {
      if (row.payment_proof_path) {
        const { data: signed } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(row.payment_proof_path, 3600);
        if (signed?.signedUrl) {
          urlMap[row.id] = signed.signedUrl;
        }
      }
    }
    setProofUrls(urlMap);
    setLoadingHistory(false);
  }

  function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      toast.error("Ukuran file melebihi 5MB.");
      return;
    }

    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submitSubscription() {
    if (!user || !selectedPlan) return;

    setSubmitting(true);
    try {
      let proofPath: string | null = null;

      if (proofFile) {
        const ext = proofFile.type.includes("png") ? "png" : proofFile.type.includes("webp") ? "webp" : "jpg";
        proofPath = `${user.id}/proof-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(proofPath, proofFile, { contentType: proofFile.type, upsert: false });

        if (uploadError) throw uploadError;
      }

      const { error: rpcError } = await supabase.rpc("create_subscription", {
        p_plan: selectedPlan,
        p_payment_proof_path: proofPath,
        p_notes: notes.trim() || null,
      });

      if (rpcError) throw rpcError;

      toast.success("Pesanan berlangganan berhasil dikirim. Menunggu verifikasi admin.");
      setSelectedPlan(null);
      setNotes("");
      setProofFile(null);
      setProofPreview(null);
      await loadSubscriptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim pesanan.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Nomor rekening disalin.");
  }

  const isPremium = tier === "premium";
  const pendingSub = subscriptions.find((s) => s.status === "pending");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Berlangganan Premium"
        description="Upgrade ke paket Premium untuk akses tanpa batas dan bebas iklan."
        icon={Crown}
      />

      {isPremium ? (
        <Card className="mb-6 border-accent/30 bg-accent/5">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="size-6 text-accent" />
            <div>
              <p className="font-semibold text-foreground">Anda sudah pengguna Premium</p>
              <p className="text-sm text-muted-foreground">
                Nikmati semua fitur tanpa batas. Perpanjang langganan Anda di sini kapan saja.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pendingSub ? (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="size-5 text-amber-500 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Pesanan Anda sedang diverifikasi</p>
              <p className="text-muted-foreground">
                Paket {pendingSub.plan === "weekly" ? "Mingguan" : pendingSub.plan === "monthly" ? "Bulanan" : "Tahunan"} — {formatRupiah(pendingSub.amount)}. Admin akan memverifikasi pembayaran Anda.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {activePlans.map((plan) => {
          const isSelected = selectedPlan === plan.key;
          const isPopular = plan.key === "monthly";
          return (
            <Card
              key={plan.key}
              className={cn(
                "relative cursor-pointer transition-all duration-200",
                isSelected ? "border-accent ring-2 ring-accent/30" : "hover:border-foreground/30",
              )}
              onClick={() => setSelectedPlan(plan.key)}
            >
              {isPopular ? (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                  Populer
                </Badge>
              ) : null}
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{plan.label}</CardTitle>
                <CardDescription>{plan.duration}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{formatRupiah(plan.price)}</p>
                <Separator className="my-3" />
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isSelected ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent">
                    <CheckCircle2 className="size-4" /> Paket dipilih
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activePlans.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada paket berlangganan yang tersedia saat ini. Silakan hubungi admin.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {selectedPlan ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-primary" /> Instruksi Pembayaran
            </CardTitle>
            <CardDescription>
              Transfer sesuai nominal, lalu unggah bukti pembayaran di bawah ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">Transfer ke rekening berikut:</p>
              {settings.manual_payment_info ? (
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{settings.manual_payment_info}</pre>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank BCA</p>
                      <p className="font-mono font-semibold text-foreground">1234567890</p>
                      <p className="text-xs text-muted-foreground">a.n. ROY DIGITAL</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard("1234567890")}>
                      <Copy className="size-3.5" /> Salin
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Hubungi admin untuk info rekening lainnya.</p>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total yang harus dibayar:</span>
                <span className="text-lg font-bold text-accent">
                  {formatRupiah(plans.find((p) => p.key === selectedPlan)?.price ?? 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bukti Pembayaran (opsional)</Label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex size-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30">
                  {proofPreview ? (
                    <img src={proofPreview} alt="Bukti pembayaran" className="h-full w-full object-cover" />
                  ) : (
                    <Receipt className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProofChange}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-4" /> {proofFile ? "Ganti Bukti" : "Unggah Bukti"}
                  </Button>
                  {proofFile ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                    >
                      <XCircle className="size-4" /> Hapus
                    </Button>
                  ) : null}
                  <p className="text-xs text-muted-foreground">JPG, PNG, atau WEBP. Maks 5MB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan untuk Admin (opsional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Sudah transfer dari rekening BCA atas nama Budi"
                rows={2}
              />
            </div>

            <Button onClick={submitSubscription} disabled={submitting} className="w-full" size="lg">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Mengirim...
                </>
              ) : (
                <>
                  <Crown className="size-4" /> Kirim Pesanan Berlangganan
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Riwayat Berlangganan</CardTitle>
          <CardDescription>Status pesanan berlangganan Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat berlangganan.</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => {
                const planLabel = sub.plan === "weekly" ? "Mingguan" : sub.plan === "monthly" ? "Bulanan" : "Tahunan";
                const proofUrl = proofUrls[sub.id];
                return (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      {sub.status === "pending" ? (
                        <Clock className="size-5 text-amber-500" />
                      ) : sub.status === "approved" ? (
                        <CheckCircle2 className="size-5 text-green-500" />
                      ) : (
                        <XCircle className="size-5 text-destructive" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">Paket {planLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(sub.amount)} — {new Date(sub.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        {sub.admin_notes ? (
                          <p className="mt-1 text-xs text-muted-foreground italic">Catatan admin: {sub.admin_notes}</p>
                        ) : null}
                        {sub.status === "approved" && sub.premium_expires_at ? (
                          <p className="mt-1 text-xs text-green-600">
                            Premium aktif hingga {new Date(sub.premium_expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                          </p>
                        ) : null}
                        {proofUrl ? (
                          <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Receipt className="size-3" /> Lihat bukti pembayaran
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant={sub.status === "approved" ? "default" : sub.status === "pending" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {sub.status === "approved" ? "Disetujui" : sub.status === "pending" ? "Menunggu" : "Ditolak"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
