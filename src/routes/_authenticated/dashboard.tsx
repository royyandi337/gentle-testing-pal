import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  FileText,
  FileType2,
  Images,
  Sparkles,
  Wand2,
  FileImage,
  Combine,
  Minimize2,
  FileOutput,
  FolderClock,
  Printer,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { EmptyState, ErrorState } from "@/components/shared/EmptyState";

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

const CATEGORIES = [
  {
    to: "/pas-foto",
    icon: Camera,
    title: "Pas Foto",
    desc: "Upload sampai siap cetak, lengkap dengan AI.",
  },
  {
    to: "/pdf-tools",
    icon: FileText,
    title: "PDF Tools",
    desc: "Convert, gabung, kompres, dan amankan PDF.",
  },
  {
    to: "/word-tools",
    icon: FileType2,
    title: "Word Tools",
    desc: "Konversi dokumen Word tanpa merusak format.",
  },
  {
    to: "/photo-tools",
    icon: Images,
    title: "Photo Tools",
    desc: "Resize, kompres, dan konversi banyak foto sekaligus.",
  },
] as const;

const POPULAR = [
  { to: "/pas-foto", icon: Camera, label: "Pas Foto 3×4", meta: "Alur 6 langkah" },
  { to: "/ai-tools", icon: Wand2, label: "Hapus Background AI", meta: "Dipakai 9× bulan ini" },
  { to: "/word-tools", icon: FileOutput, label: "PDF ke Word", meta: "Terakhir dipakai kemarin" },
  { to: "/photo-tools", icon: Printer, label: "Cetak Label/Resi", meta: "Baru — belum pernah dipakai" },
  { to: "/photo-tools", icon: Layers, label: "Kolase Foto", meta: "Baru — belum pernah dipakai" },
  { to: "/photo-tools", icon: ImageIcon, label: "Polaroid", meta: "Baru — belum pernah dipakai" },
] as const;

function Dashboard() {
  const settings = useSiteSettings();

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero card — navy-deep, not full-bleed */}
      <section className="mb-8 overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8 md:grid md:grid-cols-[1.3fr_0.7fr] md:items-center md:gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">
            Pas foto dan dokumen resmi, beres dalam satu alur.
          </h1>
          <p className="mt-2.5 max-w-md text-sm text-primary-foreground/70">
            {settings.site_tagline ||
              "Dari upload sampai siap cetak — hapus background, pertajam wajah, atur ukuran, susun ke kertas."}
          </p>
          <Link
            to="/pas-foto"
            className="mt-5 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-white/90"
          >
            Mulai Pas Foto
          </Link>
        </div>
        {/* Decorative strip — tilted photo frames */}
        <div className="mt-6 hidden md:block">
          <div className="mx-auto w-fit -rotate-3 space-y-1.5 rounded-md bg-white p-2 pb-4 shadow-lg">
            {[
              { label: "Upload", bg: "bg-gradient-to-br from-slate-600 to-slate-800" },
              { label: "Remove BG", bg: "bg-[#C6392F]" },
              { label: "Enhance", bg: "bg-[#27538F]" },
              { label: "Siap cetak", bg: "bg-[#1E7A4C]" },
            ].map((f) => (
              <div
                key={f.label}
                className={`flex h-14 w-36 items-end rounded px-1.5 py-1 text-[9px] font-semibold text-white ${f.bg}`}
              >
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category grid — navy top border accent */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kategori utama
      </h2>
      <div className="mb-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Link key={c.title} to={c.to} className="group">
            <Card className="h-full border-t-[3px] border-t-primary transition-shadow group-hover:shadow-md">
              <CardContent className="p-4">
                <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-muted">
                  <c.icon className="size-4 text-primary" />
                </div>
                <h3 className="font-display text-sm font-semibold">{c.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Popular tools — row style */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sering dipakai
      </h2>
      <Card className="mb-8">
        <CardContent className="divide-y divide-border p-0">
          {POPULAR.map((t) => (
            <Link key={t.label} to={t.to} className="block">
              <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <t.icon className="size-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{t.label}</span>
                <span className="ml-auto text-right text-xs text-muted-foreground">{t.meta}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Empty & error state examples */}
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contoh tampilan kosong &amp; error
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <EmptyState
          icon={FolderClock}
          title="Belum ada riwayat"
          description="Hasil dari Pas Foto, PDF, Word, dan Photo Tools akan muncul di sini setelah kamu memprosesnya."
        />
        <ErrorState
          title="Proses AI gagal"
          description="Server AI tidak merespons. Coba lagi, atau lewati langkah ini dan lanjutkan manual."
        />
      </div>
    </div>
  );
}
