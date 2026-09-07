import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  FileText,
  FileType2,
  Images,
  FileEdit,
  Clock,
  Zap,
  Crown,
  EyeOff,
  Upload,
  Scissors,
  Wand2,
  Printer,
  ArrowRight,
  QrCode,
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { listHistory, type HistoryRow } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Pusat kendali semua tools foto dan dokumen ROY DIGITAL SOLUTION.",
      },
      { property: "og:title", content: "Dashboard — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Pusat kendali semua tools foto dan dokumen ROY DIGITAL SOLUTION.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const FLOW_CHIPS = [
  { label: "Upload", icon: Upload },
  { label: "Remove BG", icon: Scissors },
  { label: "Enhance", icon: Wand2 },
  { label: "Siap cetak", icon: Printer },
];

const CATEGORIES = [
  { to: "/pas-foto", icon: Camera, title: "Pas Foto", desc: "Upload sampai siap cetak, lengkap dengan editor dan AI.", big: true },
  { to: "/ai-tools", icon: Wand2, title: "AI Tools", desc: "Enhance, remove background, dan auto-crop otomatis." },
  { to: "/pdf-tools", icon: FileText, title: "PDF Tools", desc: "Convert, gabung, kompres, dan kelola PDF." },
  { to: "/word-tools", icon: FileType2, title: "Word Tools", desc: "Konversi dokumen Word tanpa merusak banyak format." },
  { to: "/templat-surat", icon: FileEdit, title: "Templat Surat", desc: "Pilih templat, isi bagian kosong, langsung jadi." },
  { to: "/photo-tools", icon: Images, title: "Photo Tools", desc: "Resize, kompres, convert, dan optimalkan gambar." },
  { to: "/qr-code", icon: QrCode, title: "QR Code", desc: "Buat QR code custom untuk URL, teks, WiFi, dan lainnya." },
] as const;

const TIER_BENEFITS: Record<string, string> = {
  trial: "10 kredit AI harian, iklan tampil, dukungan komunitas.",
  regular: "100 kredit AI harian, iklan disembunyikan, dukungan prioritas.",
  premium: "Kredit AI tak terbatas, tanpa iklan, dukungan eksklusif.",
};

function Dashboard() {
  const settings = useSiteSettings();
  const { tier, remaining, dailyLimit, loading } = useCredits();
  const { data: recentItems } = useQuery({
    queryKey: ["dashboard-history"],
    queryFn: listHistory,
    staleTime: 30_000,
  });

  const isPremium = tier === "premium" || remaining === -1;
  const creditLabel = isPremium ? "Tak terbatas" : loading ? "…" : `${remaining} / ${dailyLimit}`;
  const adLabel = tier === "trial" ? "Tampil" : "Tersembunyi";
  const tierLabel = loading ? "…" : (tier ?? "trial");
  const tierBenefit = TIER_BENEFITS[tier ?? "trial"] ?? TIER_BENEFITS.trial!;

  return (
    <div className="mx-auto max-w-[1000px]">
      {/* Hero — navy with flow chips */}
      <section className="relative mb-7 flex flex-col gap-8 overflow-hidden rounded-[22px] bg-[#0E1B30] p-7 md:flex-row md:items-center md:justify-between md:p-9">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 90% 10%, rgba(199,154,70,.14), transparent 55%)" }}
        />
        <div className="relative">
          <h1 className="max-w-[400px] font-display text-2xl font-bold leading-[1.2] text-white md:text-[27px]">
            Pas foto dan dokumen resmi, beres dalam satu alur.
          </h1>
          <p className="mt-3 max-w-[360px] text-sm text-[#B9C3D6]">
            {settings.site_tagline || "Solusi Digital untuk Foto, Dokumen & Kreativitas."}
          </p>
          <Link
            to="/pas-foto"
            className="relative mt-5 inline-flex items-center gap-2 rounded-[11px] bg-white px-5 py-2.5 text-[14.5px] font-semibold text-[#0E1B30] transition hover:bg-white/90"
          >
            <FileText className="size-4" strokeWidth={2} />
            Mulai Pas Foto
          </Link>
        </div>
        <div className="relative flex shrink-0 flex-wrap gap-2.5 md:flex-nowrap">
          {FLOW_CHIPS.map((chip) => (
            <div
              key={chip.label}
              className="flex min-w-[88px] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.07] px-4 py-3 text-center"
            >
              <chip.icon className="size-3.5 text-[#C79A46]" strokeWidth={1.8} />
              <span className="text-[11.5px] font-semibold text-[#C7CEDB]">{chip.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Category cards */}
      <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Link key={c.title} to={c.to} className="group">
            <div className="h-full rounded-2xl border border-border bg-card p-5 transition-colors group-hover:border-[#0E1B30] group-hover:shadow-sm">
              <div className="mb-4 flex size-10 items-center justify-center rounded-[11px] bg-paper-dim">
                <c.icon className="size-5 text-primary" strokeWidth={1.8} />
              </div>
              <h3 className="font-display text-[14.5px] font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Lower panels */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent activity */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h4 className="mb-4 text-[14.5px] font-semibold text-foreground">Aktivitas terbaru</h4>
          {recentItems && recentItems.length > 0 ? (
            <div className="divide-y divide-border">
              {recentItems.slice(0, 5).map((item: HistoryRow) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper-dim">
                    <FileText className="size-3.5 text-slate" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{item.name}</p>
                    <p className="text-[11.5px] text-slate-light">{item.tool} • {new Date(item.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <Link to="/riwayat" className="text-[11.5px] font-medium text-primary hover:underline">Lihat</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-7 text-center">
              <div className="mb-3.5 flex size-10 items-center justify-center rounded-full bg-paper-dim">
                <Clock className="size-4 text-slate-light" strokeWidth={1.8} />
              </div>
              <strong className="text-[13.5px] font-semibold text-slate">Belum ada aktivitas</strong>
              <span className="mt-1 text-[12.5px] text-slate-light">Riwayat proses akan muncul di sini</span>
              <Link
                to="/pas-foto"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-medium text-foreground transition hover:bg-paper-dim"
              >
                Coba Pas Foto sekarang
                <ArrowRight className="size-3" strokeWidth={2} />
              </Link>
            </div>
          )}
        </div>

        {/* Account status */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h4 className="mb-4 text-[14.5px] font-semibold text-foreground">Status akun</h4>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-[13.2px] text-slate">
                <Crown className="size-4 text-accent" /> Tier
              </span>
              <span className="text-[13.2px] font-semibold capitalize text-foreground">
                {tierLabel}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-[13.2px] text-slate">
                <Zap className="size-4 text-accent" /> Kredit AI harian
              </span>
              <span className="text-[13.2px] font-semibold text-foreground">{creditLabel}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-[13.2px] text-slate">
                <EyeOff className="size-4 text-slate-light" /> Iklan
              </span>
              <span className="text-[13.2px] font-semibold text-foreground">{loading ? "…" : adLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
