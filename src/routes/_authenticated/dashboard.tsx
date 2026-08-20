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
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    desc: "Buat pas foto profesional dengan editor dan AI.",
  },
  {
    to: "/pdf-tools",
    icon: FileText,
    title: "PDF Tools",
    desc: "Convert, split, merge, compress, dan kelola PDF.",
  },
  {
    to: "/word-tools",
    icon: FileType2,
    title: "Word Tools",
    desc: "Kelola dan konversi dokumen Word.",
  },
  {
    to: "/photo-tools",
    icon: Images,
    title: "Photo Tools",
    desc: "Resize, compress, convert, dan optimalkan gambar.",
  },
] as const;

const POPULAR = [
  { to: "/pas-foto", icon: Camera, label: "Pas Foto 3 × 4", ready: true },
  { to: "/pas-foto", icon: Wand2, label: "AI Remove Background", ready: false },
  { to: "/pas-foto", icon: Sparkles, label: "AI Image Enhance", ready: false },
  { to: "/word-tools", icon: FileOutput, label: "PDF to Word", ready: false },
  { to: "/pdf-tools", icon: Combine, label: "PDF Merge", ready: true },
  { to: "/pdf-tools", icon: Minimize2, label: "PDF Compress", ready: true },
  { to: "/pdf-tools", icon: FileImage, label: "JPG to PDF", ready: true },
] as const;

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="mb-8 overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Selamat Datang di ROY DIGITAL SOLUTION
        </h1>
        <p className="mt-3 max-w-2xl text-primary-foreground/80">
          Solusi digital untuk foto, dokumen, dan kebutuhan kreatif Anda.
        </p>
      </section>

      <PageHeader title="Kategori Utama" description="Pilih kategori tool yang Anda butuhkan." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Link key={c.title} to={c.to} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader>
                <c.icon className="size-6 text-primary" />
                <CardTitle className="text-base">{c.title}</CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <PageHeader title="Tools Populer" description="Akses cepat ke tool yang sering dipakai." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR.map((t) => (
            <Link key={t.label} to={t.to}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                    <t.icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                  {!t.ready ? (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Menunggu AI
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
