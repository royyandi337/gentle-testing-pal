import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  FileText,
  FileType2,
  Images,
  Check,
  X,
  Upload,
  Scissors,
  Wand2,
  Printer,
} from "lucide-react";

const TITLE = "ROY DIGITAL SOLUTION — Pas Foto, PDF & Photo Tools Online";
const DESCRIPTION =
  "Satu tempat untuk bikin pas foto siap cetak, rapikan berkas PDF & Word, dan olah foto — lengkap dengan bantuan AI, dari upload sampai siap dicetak.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FLOW_STEPS = [
  { n: 1, icon: Upload, title: "Upload foto", desc: "Ambil dari galeri atau kamera", color: "#3B4C70" },
  { n: 2, icon: Scissors, title: "Remove background", desc: "Otomatis, latar merah/biru/putih", color: "#B4553E" },
  { n: 3, icon: Wand2, title: "Enhance & ukuran", desc: "2x3, 3x4, 4x6 sekali atur", color: "#3F6FB0" },
  { n: 4, icon: Printer, title: "Siap cetak", desc: "Layout A4, langsung unduh", color: "#3E7C5A" },
];

const FEATURES = [
  { icon: Camera, title: "Pas Foto", desc: "Upload sampai siap cetak, lengkap dengan editor dan remove background berbasis AI.", big: true, miniFlow: ["Upload", "Remove BG", "Enhance", "Cetak A4"] },
  { icon: FileText, title: "PDF Tools", desc: "Convert, gabung, kompres, dan lindungi PDF tanpa install aplikasi tambahan." },
  { icon: FileType2, title: "Word Tools", desc: "Kelola dan konversi dokumen Word tanpa merusak format aslinya." },
  { icon: Images, title: "Photo Tools", desc: "Resize, kompres, convert, kolase, dan cetak label — sekali jalan, banyak file." },
];

const PRICING = [
  {
    tier: "Trial",
    price: "Rp0",
    period: "/ selamanya",
    desc: "Untuk coba-coba dulu sebelum pakai rutin.",
    features: ["10 kredit AI per hari", "Akses semua kategori alat", "Hasil pakai watermark ringan", "Menampilkan iklan"],
    featured: false,
    cta: "Mulai gratis",
  },
  {
    tier: "Reguler",
    price: "Rp29rb",
    period: "/ bulan",
    desc: "Untuk pemakaian harian tanpa buru-buru habis kredit.",
    features: ["100 kredit AI per hari", "Tanpa watermark", "Tanpa iklan", "Batch processing di Photo Tools"],
    featured: true,
    cta: "Pilih Reguler",
  },
  {
    tier: "Premium",
    price: "Rp79rb",
    period: "/ bulan",
    desc: "Untuk usaha kecil dengan kebutuhan cetak & AI setiap hari.",
    features: ["Kredit AI tanpa batas", "Preset KTP & Kartu ID", "Kolase & Polaroid", "Cetak Label/Resi & dukungan prioritas"],
    featured: false,
    cta: "Pilih Premium",
  },
];

const COMPARE_ROWS: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Kredit AI per hari", "10", "100", "Tanpa batas"],
  ["Pas Foto (upload → siap cetak)", true, true, true],
  ["PDF Tools (convert, gabung, kompres)", true, true, true],
  ["Word Tools", true, true, true],
  ["Photo Tools batch processing", false, true, true],
  ["Cetak Label/Resi", false, true, true],
  ["Preset KTP & Kartu ID", false, false, true],
  ["Kolase & Polaroid", false, false, true],
  ["Tanpa watermark", false, true, true],
  ["Tanpa iklan", false, true, true],
  ["Dukungan prioritas", false, false, true],
];

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex size-8 items-center justify-center rounded-[10px] ${light ? "bg-white/10" : "bg-primary"}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" className="size-4">
          <path d="M12 2 3 7v10l9 5 9-5V7z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 22V12" />
        </svg>
      </div>
      <div className={`font-display text-[15px] font-bold leading-[1.1] ${light ? "text-white" : "text-foreground"}`}>
        ROY DIGITAL
        <small className={`block font-sans text-[10.5px] font-medium ${light ? "text-white/50" : "text-slate"}`} style={{ letterSpacing: "0.04em" }}>
          SOLUTION
        </small>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/86 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 md:px-8">
          <BrandMark />
          <div className="hidden items-center gap-9 md:flex">
            <a href="#fitur" className="text-[14.5px] font-medium text-slate hover:text-foreground">Fitur</a>
            <a href="#harga" className="text-[14.5px] font-medium text-slate hover:text-foreground">Harga</a>
            <a href="#faq" className="text-[14.5px] font-medium text-slate hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/auth"
              className="hidden rounded-[11px] border border-border bg-transparent px-4 py-2 text-[13.5px] font-semibold text-foreground transition hover:bg-card sm:inline-flex"
            >
              Masuk
            </Link>
            <Link
              to="/auth"
              className="rounded-[11px] bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition hover:bg-[#0E1B30]"
            >
              Coba Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-[1180px] px-4 py-14 md:px-8 md:py-22">
        <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.85fr] md:gap-16">
          <div>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="size-[7px] rounded-full bg-success" />
              <span className="text-[13.5px] font-medium text-slate">Dipakai untuk pas foto, dokumen, dan kebutuhan cetak harian</span>
            </div>
            <h1 className="max-w-[560px] text-4xl font-bold leading-[1.06] text-foreground md:text-[52px]">
              Urus pas foto dan dokumen resmi tanpa buka lima aplikasi berbeda.
            </h1>
            <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-slate">
              Satu tempat untuk bikin pas foto siap cetak, rapikan berkas PDF &amp; Word, dan olah foto — lengkap dengan bantuan AI, dari upload sampai siap dicetak.
            </p>
            <div className="mt-8 flex gap-3.5">
              <Link to="/auth" className="rounded-[11px] bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-primary-foreground transition hover:bg-[#0E1B30]">
                Mulai gratis
              </Link>
              <a href="#fitur" className="rounded-[11px] border border-border bg-transparent px-5 py-2.5 text-[14.5px] font-semibold text-foreground transition hover:bg-card">
                Lihat semua fitur
              </a>
            </div>
            <div className="mt-9 flex max-w-[480px] gap-7 border-t border-border pt-6">
              {[
                ["4 kategori", "alat foto & dokumen"],
                ["10 kredit", "AI gratis / hari di trial"],
                ["0 rupiah", "untuk mulai mencoba"],
              ].map(([strong, span]) => (
                <div key={strong}>
                  <strong className="block font-display text-xl font-bold text-foreground">{strong}</strong>
                  <span className="text-[12.5px] text-slate-light">{span}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flow card */}
          <div className="relative overflow-hidden rounded-3xl bg-[#0E1B30] p-6 md:p-7">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 85% 0%, rgba(199,154,70,.16), transparent 55%)" }} />
            <div className="relative mb-5 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#9AA6BC]">Alur Pas Foto</span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8FD1A8]">
                <i className="size-1.5 rounded-full bg-[#8FD1A8]" /> Siap cetak
              </span>
            </div>
            <div className="relative flex flex-col">
              {FLOW_STEPS.map((step, i) => (
                <div key={step.n} className="relative flex items-center gap-3.5 py-3.5">
                  {i < FLOW_STEPS.length - 1 && (
                    <div className="absolute left-[19px] top-[44px] bottom-[-10px] w-px bg-white/14" />
                  )}
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-[11px] font-display text-sm font-semibold text-white"
                    style={{ background: step.color, zIndex: 1 }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <strong className="block text-[14.5px] font-semibold text-white">{step.title}</strong>
                    <span className="text-[12.5px] text-[#98A3B8]">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-[1180px] px-4 py-14 md:px-8 md:py-22">
        <div className="mb-12 max-w-[560px]">
          <h2 className="text-3xl font-bold text-foreground md:text-[34px]">Empat alat, satu akun</h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">Setiap kategori dibuat untuk pekerjaan yang sering berulang — bukan fitur tempelan.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-[14px] border p-6 ${f.big ? "border-primary bg-primary lg:col-span-2" : "border-border bg-card"}`}
            >
              <div className={`mb-4 flex size-10 items-center justify-center rounded-[11px] ${f.big ? "bg-white/10" : "bg-paper-dim"}`} style={!f.big ? { background: "var(--paper-dim)" } : undefined}>
                <f.icon className={`size-5 ${f.big ? "text-white" : "text-primary"}`} strokeWidth={1.8} />
              </div>
              <h3 className={`font-display font-semibold ${f.big ? "text-xl text-white" : "text-[17px] text-foreground"}`}>{f.title}</h3>
              <p className={`mt-2 text-[13.8px] leading-relaxed ${f.big ? "text-[#C7CEDB]" : "text-slate"}`}>{f.desc}</p>
              {f.big && f.miniFlow && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {f.miniFlow.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/8 px-3 py-1.5 text-[11.5px] text-[#DCE2EC]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="mx-auto max-w-[1180px] px-4 py-14 md:px-8 md:py-22">
        <div className="mb-12 max-w-[560px]">
          <h2 className="text-3xl font-bold text-foreground md:text-[34px]">Harga yang jelas, tanpa syarat tersembunyi</h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">Mulai gratis, naik tingkat kalau kebutuhan harian sudah lebih banyak dari batas trial.</p>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.tier}
              className={`flex flex-col rounded-[20px] border p-8 ${p.featured ? "border-[#0E1B30] bg-[#0E1B30] text-white lg:-translate-y-2.5" : "border-border bg-card"}`}
              style={p.featured ? { boxShadow: "0 24px 48px rgba(14,27,48,.28)" } : undefined}
            >
              <span className={`text-[13.5px] font-semibold ${p.featured ? "text-[#B9C3D6]" : "text-slate"}`}>{p.tier}</span>
              <div className="mt-4 flex items-baseline gap-1.5">
                <strong className="font-display text-4xl font-bold">{p.price}</strong>
                <span className={`text-[13.5px] ${p.featured ? "text-[#9FAAC1]" : "text-slate"}`}>{p.period}</span>
              </div>
              <p className={`mt-2.5 text-[13.8px] leading-relaxed ${p.featured ? "text-[#B9C3D6]" : "text-slate"}`}>{p.desc}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-[13.8px]">
                    <Check className={`size-4 shrink-0 ${p.featured ? "text-[#8FD1A8]" : "text-success"}`} strokeWidth={2} />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-7 w-full rounded-[11px] py-2.5 text-center text-[14.5px] font-semibold transition ${p.featured ? "bg-white text-[#0E1B30]" : "bg-primary text-primary-foreground hover:bg-[#0E1B30]"}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-16 overflow-hidden rounded-[20px] border border-border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-border bg-paper-dim px-5 py-4 text-left text-[13px] font-semibold text-slate" style={{ background: "var(--paper-dim)" }}>Fitur</th>
                {[
                  ["Trial", "Rp0"],
                  ["Reguler", "Rp29rb/bln"],
                  ["Premium", "Rp79rb/bln"],
                ].map(([tier, price]) => (
                  <th key={tier} className="border-b border-border bg-paper-dim px-5 py-4 text-center" style={{ background: "var(--paper-dim)" }}>
                    <strong className="block font-display text-[15px] font-semibold text-foreground">{tier}</strong>
                    <em className="not-italic text-[12px] text-slate-light">{price}</em>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([label, ...vals]) => (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-[13.8px] font-medium text-slate">{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-5 py-3.5 text-center text-[13.8px] text-foreground">
                      {typeof v === "boolean" ? (
                        v ? <Check className="mx-auto size-4 text-success" strokeWidth={2} /> : <X className="mx-auto size-4 text-slate-light" strokeWidth={2} />
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-[1180px] px-4 py-14 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] bg-[#0E1B30] p-10 md:p-16 md:flex-row md:items-center">
          <div>
            <h2 className="max-w-[420px] text-2xl font-bold text-white md:text-[28px]">Coba dulu, tanpa kartu kredit</h2>
            <p className="mt-2.5 max-w-[420px] text-[14.5px] text-[#AEB8CB]">Trial langsung aktif begitu daftar. Upgrade kapan saja lewat halaman akun.</p>
          </div>
          <Link to="/auth" className="rounded-[11px] bg-white px-5 py-2.5 text-[14.5px] font-semibold text-[#0E1B30] transition hover:bg-white/90">
            Daftar sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-border py-12">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-10 px-4 md:px-8">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-[220px] text-[13.5px] text-slate">Solusi digital untuk foto, dokumen, dan kebutuhan kreatif.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <h4 className="mb-3.5 text-[13px] text-slate-light">Produk</h4>
              <a href="#fitur" className="mb-2.5 block text-[13.8px] text-slate hover:text-foreground">Pas Foto</a>
              <a href="#fitur" className="mb-2.5 block text-[13.8px] text-slate hover:text-foreground">PDF Tools</a>
              <a href="#fitur" className="mb-2.5 block text-[13.8px] text-slate hover:text-foreground">Word Tools</a>
              <a href="#fitur" className="block text-[13.8px] text-slate hover:text-foreground">Photo Tools</a>
            </div>
            <div>
              <h4 className="mb-3.5 text-[13px] text-slate-light">Akun</h4>
              <a href="#harga" className="mb-2.5 block text-[13.8px] text-slate hover:text-foreground">Harga</a>
              <Link to="/auth" className="mb-2.5 block text-[13.8px] text-slate hover:text-foreground">Masuk</Link>
              <Link to="/auth" className="block text-[13.8px] text-slate hover:text-foreground">Daftar</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-[1180px] border-t border-border px-4 pt-5 text-[12.5px] text-slate-light md:px-8">
          © 2026 ROY Digital Solution. Semua hak dilindungi.
        </div>
      </footer>
    </div>
  );
}
