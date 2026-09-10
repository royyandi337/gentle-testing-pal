import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  amount: number;
  status: string;
  payment_proof_path: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
};

type ProfileSummary = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function planLabel(plan: string): string {
  if (plan === "weekly") return "Mingguan";
  if (plan === "monthly") return "Bulanan";
  return "Tahunan";
}

export function SubscriptionReviewPanel() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan, amount, status, payment_proof_path, notes, admin_notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal memuat pengajuan pembayaran.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as SubscriptionRow[];
    setSubscriptions(rows);

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      if (profileData) {
        setProfiles(
          Object.fromEntries(
            (profileData as ProfileSummary[]).map((p) => [p.id, p]),
          ),
        );
      }
    }

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
    setLoading(false);
  }

  async function processSubscription(id: string, action: "approve" | "reject") {
    setProcessingId(id);
    const rpcName = action === "approve" ? "approve_subscription" : "reject_subscription";
    const { error } = await supabase.rpc(rpcName, {
      p_subscription_id: id,
      p_admin_notes: adminNotes[id]?.trim() || null,
    });
    setProcessingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      action === "approve"
        ? "Pembayaran disetujui dan Premium diaktifkan."
        : "Pengajuan pembayaran ditolak.",
    );
    await loadSubscriptions();
  }

  const pendingCount = subscriptions.filter((r) => r.status === "pending").length;

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-4 text-primary" /> Verifikasi Pembayaran Premium
          {pendingCount > 0 ? <Badge variant="secondary">{pendingCount} menunggu</Badge> : null}
        </CardTitle>
        <CardDescription>
          Periksa bukti transfer dan aktifkan Premium setelah pembayaran diterima.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada pengajuan pembayaran.
          </p>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => {
              const profile = profiles[sub.user_id];
              const isPending = sub.status === "pending";
              const proofUrl = proofUrls[sub.id];
              return (
                <div key={sub.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {planLabel(sub.plan)} — {formatRupiah(sub.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.full_name || profile?.email || "Pengguna"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sub.created_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        sub.status === "approved"
                          ? "default"
                          : sub.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {sub.status === "approved"
                        ? "Disetujui"
                        : sub.status === "pending"
                          ? "Menunggu"
                          : "Ditolak"}
                    </Badge>
                  </div>

                  {sub.notes ? (
                    <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      Catatan pengguna: {sub.notes}
                    </p>
                  ) : null}

                  {proofUrl ? (
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <a href={proofUrl} target="_blank" rel="noreferrer">
                        Lihat bukti pembayaran <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <p className="mt-3 text-xs text-amber-600">
                      Pengguna belum mengunggah bukti pembayaran.
                    </p>
                  )}

                  {isPending ? (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <Label htmlFor={`admin-notes-${sub.id}`}>Catatan admin (opsional)</Label>
                        <Input
                          id={`admin-notes-${sub.id}`}
                          value={adminNotes[sub.id] ?? ""}
                          onChange={(e) =>
                            setAdminNotes((cur) => ({ ...cur, [sub.id]: e.target.value }))
                          }
                          placeholder="Contoh: Pembayaran sudah diterima"
                        />
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => void processSubscription(sub.id, "approve")}
                            disabled={processingId !== null}
                          >
                            {processingId === sub.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            Setujui & Aktifkan Premium
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void processSubscription(sub.id, "reject")}
                            disabled={processingId !== null}
                          >
                            <XCircle className="size-4" /> Tolak
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
