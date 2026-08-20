import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, FileText, FileType2, Images, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TITLE = "ROY DIGITAL SOLUTION — Pas Foto, PDF & Photo Tools Online";
const DESCRIPTION =
  "Solusi digital untuk foto, dokumen, dan kebutuhan kreatif Anda: pas foto profesional, konversi & kelola PDF, dokumen Word, serta optimasi gambar.";

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

const CATEGORIES = [
  { icon: Camera, title: "Pas Foto", desc: "Buat pas foto profesional dengan editor dan AI." },
  { icon: FileText, title: "PDF Tools", desc: "Convert, split, merge, compress, dan kelola PDF." },
  { icon: FileType2, title: "Word Tools", desc: "Kelola dan konversi dokumen Word." },
  { icon: Images, title: "Photo Tools", desc: "Resize, compress, convert, dan optimalkan gambar." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ROY DIGITAL SOLUTION</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Masuk</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Platform digital tools profesional
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Solusi Digital untuk Foto, Dokumen &amp; Kreativitas
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{DESCRIPTION}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Mulai Sekarang <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Card key={c.title}>
              <CardHeader>
                <c.icon className="size-6 text-primary" />
                <CardTitle className="text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{c.desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
