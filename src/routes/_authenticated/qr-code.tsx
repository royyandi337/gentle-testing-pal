import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, QrCode, Link2, Mail, Phone, Wifi, FileText } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadBlob } from "@/lib/image";
import { saveResult } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/qr-code")({
  head: () => ({
    meta: [
      { title: "QR Code Generator — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Buat QR code untuk URL, teks, email, telepon, dan WiFi dengan mudah.",
      },
    ],
  }),
  component: QrCodePage,
});

type QrType = "url" | "text" | "email" | "phone" | "wifi";

const QR_TYPES: { value: QrType; label: string; icon: typeof Link2 }[] = [
  { value: "url", label: "URL / Link", icon: Link2 },
  { value: "text", label: "Teks", icon: FileText },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Telepon", icon: Phone },
  { value: "wifi", label: "WiFi", icon: Wifi },
];

function buildContent(type: QrType, data: Record<string, string>): string {
  switch (type) {
    case "url":
      return data.url || "";
    case "text":
      return data.text || "";
    case "email":
      return `mailto:${data.email || ""}${data.subject ? `?subject=${encodeURIComponent(data.subject)}` : ""}`;
    case "phone":
      return `tel:${data.phone || ""}`;
    case "wifi":
      return `WIFI:T:${data.wifiSecurity || "WPA"};S:${data.wifiSsid || ""};P:${data.wifiPassword || ""};;`;
    default:
      return "";
  }
}

function QrCodePage() {
  const [type, setType] = useState<QrType>("url");
  const [data, setData] = useState<Record<string, string>>({ url: "https://" });
  const [size, setSize] = useState(256);
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [errorLevel, setErrorLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [dataUrl, setDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const content = buildContent(type, data);

  async function generate() {
    if (!content.trim()) {
      toast.error("Isi konten QR code terlebih dahulu.");
      return;
    }
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await QRCode.toCanvas(canvas, content, {
        width: size,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: color, light: bgColor },
      });
      setDataUrl(canvas.toDataURL("image/png"));
    } catch (err) {
      toast.error("Gagal membuat QR code. Coba lagi.");
    }
  }

  async function downloadPng() {
    if (!dataUrl) {
      toast.error("Buat QR code terlebih dahulu.");
      return;
    }
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    downloadBlob(blob, "qr-code.png");
    try {
      await saveResult({ category: "photo", tool: "QR Code Generator", fileName: "qr-code.png", blob });
    } catch {
      // Riwayat opsional.
    }
  }

  async function downloadSvg() {
    if (!content.trim()) {
      toast.error("Buat QR code terlebih dahulu.");
      return;
    }
    try {
      const svg = await QRCode.toString(content, {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: color, light: bgColor },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      downloadBlob(blob, "qr-code.svg");
    } catch {
      toast.error("Gagal membuat SVG.");
    }
  }

  function update(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="QR Code Generator"
        description="Buat QR code untuk URL, teks, email, nomor telepon, atau kredensial WiFi."
        icon={QrCode}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4 text-primary" /> Jenis Konten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {QR_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    variant={type === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setType(t.value);
                      setData({});
                    }}
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Konten QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {type === "url" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="qr-url">URL</Label>
                  <Input
                    id="qr-url"
                    value={data.url ?? ""}
                    onChange={(e) => update("url", e.target.value)}
                    placeholder="https://contoh.com"
                  />
                </div>
              ) : null}
              {type === "text" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="qr-text">Teks</Label>
                  <Textarea
                    id="qr-text"
                    value={data.text ?? ""}
                    onChange={(e) => update("text", e.target.value)}
                    placeholder="Tulis teks apa pun..."
                    rows={4}
                  />
                </div>
              ) : null}
              {type === "email" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-email">Email</Label>
                    <Input
                      id="qr-email"
                      type="email"
                      value={data.email ?? ""}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="nama@contoh.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-subject">Subjek (opsional)</Label>
                    <Input
                      id="qr-subject"
                      value={data.subject ?? ""}
                      onChange={(e) => update("subject", e.target.value)}
                      placeholder="Subjek email"
                    />
                  </div>
                </>
              ) : null}
              {type === "phone" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="qr-phone">Nomor Telepon</Label>
                  <Input
                    id="qr-phone"
                    type="tel"
                    value={data.phone ?? ""}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+6281234567890"
                  />
                </div>
              ) : null}
              {type === "wifi" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-ssid">Nama WiFi (SSID)</Label>
                    <Input
                      id="qr-ssid"
                      value={data.wifiSsid ?? ""}
                      onChange={(e) => update("wifiSsid", e.target.value)}
                      placeholder="Nama WiFi"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-wifi-pass">Password WiFi</Label>
                    <Input
                      id="qr-wifi-pass"
                      type="password"
                      value={data.wifiPassword ?? ""}
                      onChange={(e) => update("wifiPassword", e.target.value)}
                      placeholder="Password WiFi"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Keamanan</Label>
                    <Select
                      value={data.wifiSecurity ?? "WPA"}
                      onValueChange={(v) => update("wifiSecurity", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA/WPA2</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">Tanpa Password</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qr-size">Ukuran (px)</Label>
                  <Input
                    id="qr-size"
                    type="number"
                    min={128}
                    max={1024}
                    step={32}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value) || 256)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Koreksi Error</Label>
                  <Select
                    value={errorLevel}
                    onValueChange={(v) => setErrorLevel(v as "L" | "M" | "Q" | "H")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Rendah (7%)</SelectItem>
                      <SelectItem value="M">Sedang (15%)</SelectItem>
                      <SelectItem value="Q">Tinggi (25%)</SelectItem>
                      <SelectItem value="H">Tertinggi (30%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qr-color">Warna QR</Label>
                  <Input
                    id="qr-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 p-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qr-bg">Warna Latar</Label>
                  <Input
                    id="qr-bg"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 p-1"
                  />
                </div>
              </div>

              <Button onClick={generate} className="w-full">
                <QrCode className="size-4" /> Buat QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasil</CardTitle>
            <CardDescription>Preview dan unduh QR code Anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border-2 border-dashed bg-muted/40 p-6">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="QR Code hasil"
                  className="max-h-[280px] rounded-lg"
                />
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  <QrCode className="mx-auto mb-2 size-10 opacity-30" />
                  Klik "Buat QR Code" untuk melihat hasil
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {dataUrl ? (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={downloadPng}>
                  <Download className="size-4" /> PNG
                </Button>
                <Button variant="outline" onClick={downloadSvg}>
                  <Download className="size-4" /> SVG
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
