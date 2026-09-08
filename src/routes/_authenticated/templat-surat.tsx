import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import {
  FileEdit,
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Pencil,
  Trash2,
  Copy,
  Check,
  Sparkles,
  FileType2,
  Mail,
  Shield,
  UserCog,
  Calendar,
  Home,
  Briefcase,
  GraduationCap,
  Building2,
  PenLine,
  Upload,
  FileUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/templat-surat")({
  head: () => ({
    meta: [
      { title: "Templat Surat — ROY DIGITAL SOLUTION" },
      { name: "description", content: "Pilih templat, isi bagian kosong, langsung jadi." },
    ],
  }),
  component: TemplatSuratPage,
});

type TemplateField = { key: string; label: string; placeholder: string };
type Template = {
  id: string;
  name: string;
  desc: string;
  category: string;
  icon: ReactNode;
  fields: TemplateField[];
  body: string;
  custom?: boolean;
};

const CATEGORIES = [
  { id: "semua", label: "Semua", icon: Search },
  { id: "kerja", label: "Kerja", icon: Briefcase },
  { id: "kependudukan", label: "Kependudukan", icon: Home },
  { id: "sekolah", label: "Sekolah", icon: GraduationCap },
  { id: "rtrw", label: "RT/RW", icon: Building2 },
  { id: "bisnis", label: "Bisnis", icon: Shield },
  { id: "custom", label: "Templat Kamu", icon: PenLine },
];

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "lamaran-kerja",
    name: "Surat Lamaran Kerja",
    desc: "Format standar melamar pekerjaan ke sebuah perusahaan.",
    category: "kerja",
    icon: <Briefcase className="size-5" />,
    fields: [
      { key: "kota", label: "Kota Asal Surat", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal Surat", placeholder: "7 September 2026" },
      { key: "perusahaan", label: "Nama Perusahaan Tujuan", placeholder: "PT Maju Bersama" },
      { key: "posisi", label: "Posisi yang Dilamar", placeholder: "Staff Administrasi" },
      { key: "nama", label: "Nama Lengkap", placeholder: "Nama lengkap kamu" },
      { key: "ttl", label: "Tempat, Tanggal Lahir", placeholder: "Bogor, 1 Januari 2000" },
      { key: "pendidikan", label: "Pendidikan Terakhir", placeholder: "SMA / SMK" },
      { key: "alamat", label: "Alamat Lengkap", placeholder: "Jl. Contoh No. 10, Bogor" },
      { key: "telepon", label: "No. Telepon", placeholder: "08xxxxxxxxxx" },
      { key: "email", label: "Email", placeholder: "nama@email.com" },
    ],
    body: `<p style="text-align:right;">{{kota}}, {{tanggal}}</p>
<p>Kepada Yth.<br>HRD {{perusahaan}}<br>di Tempat</p>
<p>Dengan hormat,</p>
<p>Saya yang bertanda tangan di bawah ini:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama}}</span></div>
<div class="tpl-kv"><span class="k">Tempat, Tanggal Lahir</span><span>: {{ttl}}</span></div>
<div class="tpl-kv"><span class="k">Pendidikan Terakhir</span><span>: {{pendidikan}}</span></div>
<div class="tpl-kv"><span class="k">Alamat</span><span>: {{alamat}}</span></div>
<div class="tpl-kv"><span class="k">No. Telepon</span><span>: {{telepon}}</span></div>
<div class="tpl-kv"><span class="k">Email</span><span>: {{email}}</span></div>
<p style="margin-top:12px;">Dengan ini mengajukan permohonan untuk bergabung mengisi posisi {{posisi}} di perusahaan yang Bapak/Ibu pimpin.</p>
<p>Sebagai bahan pertimbangan, saya lampirkan Daftar Riwayat Hidup, fotokopi ijazah, dan dokumen pendukung lainnya.</p>
<p>Besar harapan saya untuk dapat bergabung dan berkontribusi. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.</p>
<p style="margin-top:36px;">Hormat saya,</p>
<p style="margin-top:52px;"><b>{{nama}}</b></p>`,
  },
  {
    id: "surat-kuasa",
    name: "Surat Kuasa",
    desc: "Memberi kuasa kepada orang lain untuk mengurus suatu keperluan.",
    category: "bisnis",
    icon: <Shield className="size-5" />,
    fields: [
      { key: "nama_pemberi", label: "Nama Pemberi Kuasa", placeholder: "Nama lengkap" },
      { key: "nik_pemberi", label: "NIK Pemberi Kuasa", placeholder: "32xxxxxxxxxxxxxx" },
      { key: "alamat_pemberi", label: "Alamat Pemberi Kuasa", placeholder: "Jl. Contoh No. 10" },
      { key: "nama_penerima", label: "Nama Penerima Kuasa", placeholder: "Nama lengkap" },
      { key: "nik_penerima", label: "NIK Penerima Kuasa", placeholder: "32xxxxxxxxxxxxxx" },
      { key: "alamat_penerima", label: "Alamat Penerima Kuasa", placeholder: "Jl. Contoh No. 12" },
      { key: "keperluan", label: "Keperluan / Urusan", placeholder: "Mengambil dokumen ijazah" },
      { key: "kota", label: "Kota", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal", placeholder: "7 September 2026" },
    ],
    body: `<p style="text-align:center;font-weight:700;font-size:16px;margin-bottom:4px;">SURAT KUASA</p>
<p>Yang bertanda tangan di bawah ini:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama_pemberi}}</span></div>
<div class="tpl-kv"><span class="k">NIK</span><span>: {{nik_pemberi}}</span></div>
<div class="tpl-kv"><span class="k">Alamat</span><span>: {{alamat_pemberi}}</span></div>
<p style="margin-top:10px;">Selanjutnya disebut <b>Pemberi Kuasa</b>, dengan ini memberikan kuasa kepada:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama_penerima}}</span></div>
<div class="tpl-kv"><span class="k">NIK</span><span>: {{nik_penerima}}</span></div>
<div class="tpl-kv"><span class="k">Alamat</span><span>: {{alamat_penerima}}</span></div>
<p style="margin-top:10px;">Selanjutnya disebut <b>Penerima Kuasa</b>, untuk mengurus dan bertindak atas nama Pemberi Kuasa dalam hal:</p>
<p style="font-style:italic;">"{{keperluan}}"</p>
<p>Demikian surat kuasa ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
<p style="margin-top:10px;">{{kota}}, {{tanggal}}</p>`,
  },
  {
    id: "surat-izin",
    name: "Surat Izin Tidak Masuk",
    desc: "Izin tidak masuk kerja atau sekolah kepada atasan/wali kelas.",
    category: "sekolah",
    icon: <GraduationCap className="size-5" />,
    fields: [
      { key: "tujuan", label: "Ditujukan Kepada", placeholder: "Bapak/Ibu Kepala Sekolah" },
      { key: "nama", label: "Nama", placeholder: "Nama lengkap" },
      { key: "kelas_jabatan", label: "Kelas / Jabatan", placeholder: "Kelas 6A / Staff Admin" },
      { key: "alasan", label: "Alasan Tidak Masuk", placeholder: "Sakit demam" },
      { key: "tanggal_izin", label: "Tanggal Tidak Masuk", placeholder: "8 September 2026" },
      { key: "kota", label: "Kota", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal Surat", placeholder: "7 September 2026" },
      { key: "nama_wali", label: "Nama Orang Tua/Wali (opsional)", placeholder: "Nama orang tua/wali" },
    ],
    body: `<p>{{kota}}, {{tanggal}}</p>
<p style="margin-top:8px;">Kepada Yth.<br>{{tujuan}}<br>di Tempat</p>
<p>Dengan hormat,</p>
<p>Yang bertanda tangan di bawah ini, {{nama_wali}} selaku orang tua/wali dari:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama}}</span></div>
<div class="tpl-kv"><span class="k">Kelas / Jabatan</span><span>: {{kelas_jabatan}}</span></div>
<p style="margin-top:10px;">Dengan ini memberitahukan bahwa yang bersangkutan tidak dapat masuk pada tanggal {{tanggal_izin}} dikarenakan {{alasan}}.</p>
<p>Demikian surat izin ini saya buat, atas perhatian dan izinnya saya ucapkan terima kasih.</p>
<p style="margin-top:36px;">Hormat saya,</p>
<p style="margin-top:52px;"><b>{{nama_wali}}</b></p>`,
  },
  {
    id: "keterangan-domisili",
    name: "Surat Keterangan Domisili",
    desc: "Keterangan tempat tinggal untuk keperluan administrasi.",
    category: "kependudukan",
    icon: <Home className="size-5" />,
    fields: [
      { key: "nama", label: "Nama Lengkap", placeholder: "Nama lengkap" },
      { key: "nik", label: "NIK", placeholder: "32xxxxxxxxxxxxxx" },
      { key: "ttl", label: "Tempat, Tanggal Lahir", placeholder: "Bogor, 1 Januari 2000" },
      { key: "jk", label: "Jenis Kelamin", placeholder: "Laki-laki / Perempuan" },
      { key: "pekerjaan", label: "Pekerjaan", placeholder: "Karyawan Swasta" },
      { key: "alamat", label: "Alamat Domisili", placeholder: "Jl. Contoh No. 10, RT/RW 01/02" },
      { key: "keperluan", label: "Keperluan Surat", placeholder: "Persyaratan administrasi bank" },
      { key: "kota", label: "Kota Penerbit", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal Surat", placeholder: "7 September 2026" },
      { key: "pejabat", label: "Nama Pejabat Penandatangan", placeholder: "Ketua RT/RW / Lurah" },
    ],
    body: `<p style="text-align:center;font-weight:700;font-size:16px;margin-bottom:4px;">SURAT KETERANGAN DOMISILI</p>
<p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama}}</span></div>
<div class="tpl-kv"><span class="k">NIK</span><span>: {{nik}}</span></div>
<div class="tpl-kv"><span class="k">Tempat, Tanggal Lahir</span><span>: {{ttl}}</span></div>
<div class="tpl-kv"><span class="k">Jenis Kelamin</span><span>: {{jk}}</span></div>
<div class="tpl-kv"><span class="k">Pekerjaan</span><span>: {{pekerjaan}}</span></div>
<div class="tpl-kv"><span class="k">Alamat</span><span>: {{alamat}}</span></div>
<p style="margin-top:10px;">Benar merupakan warga yang berdomisili di alamat tersebut di atas. Surat ini dibuat untuk keperluan {{keperluan}}.</p>
<p>Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
<p style="margin-top:10px;">{{kota}}, {{tanggal}}</p>
<p style="margin-top:10px;">Yang menerangkan,</p>
<p style="margin-top:52px;"><b>{{pejabat}}</b></p>`,
  },
  {
    id: "surat-pernyataan",
    name: "Surat Pernyataan",
    desc: "Pernyataan resmi mengenai suatu hal atau komitmen tertentu.",
    category: "kependudukan",
    icon: <FileText className="size-5" />,
    fields: [
      { key: "nama", label: "Nama Lengkap", placeholder: "Nama lengkap" },
      { key: "nik", label: "NIK", placeholder: "32xxxxxxxxxxxxxx" },
      { key: "alamat", label: "Alamat", placeholder: "Jl. Contoh No. 10" },
      { key: "isi_pernyataan", label: "Isi Pernyataan", placeholder: "Tidak akan mengulangi keterlambatan pembayaran" },
      { key: "kota", label: "Kota", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal", placeholder: "7 September 2026" },
    ],
    body: `<p style="text-align:center;font-weight:700;font-size:16px;margin-bottom:4px;">SURAT PERNYATAAN</p>
<p>Saya yang bertanda tangan di bawah ini:</p>
<div class="tpl-kv"><span class="k">Nama</span><span>: {{nama}}</span></div>
<div class="tpl-kv"><span class="k">NIK</span><span>: {{nik}}</span></div>
<div class="tpl-kv"><span class="k">Alamat</span><span>: {{alamat}}</span></div>
<p style="margin-top:10px;">Dengan ini menyatakan dengan sesungguhnya bahwa:</p>
<p style="font-style:italic;">"{{isi_pernyataan}}"</p>
<p>Demikian surat pernyataan ini saya buat dengan sebenar-benarnya, tanpa ada paksaan dari pihak manapun, untuk dapat dipergunakan sebagaimana mestinya.</p>
<p style="margin-top:10px;">{{kota}}, {{tanggal}}</p>
<p style="margin-top:10px;">Yang membuat pernyataan,</p>
<p style="margin-top:60px;"><b>{{nama}}</b></p>`,
  },
  {
    id: "undangan-resmi",
    name: "Surat Undangan Resmi",
    desc: "Mengundang seseorang atau instansi untuk hadir pada suatu acara.",
    category: "rtrw",
    icon: <Calendar className="size-5" />,
    fields: [
      { key: "tujuan", label: "Ditujukan Kepada", placeholder: "Bapak/Ibu Wali Kelas" },
      { key: "acara", label: "Nama Acara", placeholder: "Rapat Tahunan Warga" },
      { key: "hari_tanggal", label: "Hari, Tanggal Acara", placeholder: "Sabtu, 12 September 2026" },
      { key: "waktu", label: "Waktu", placeholder: "09.00 WIB – selesai" },
      { key: "tempat", label: "Tempat", placeholder: "Balai Warga RW 02" },
      { key: "agenda", label: "Agenda", placeholder: "Pembahasan program kerja" },
      { key: "kota", label: "Kota", placeholder: "Bogor" },
      { key: "tanggal", label: "Tanggal Surat", placeholder: "7 September 2026" },
      { key: "pengirim", label: "Nama Pengirim / Panitia", placeholder: "Ketua RW 02" },
    ],
    body: `<p>{{kota}}, {{tanggal}}</p>
<p style="margin-top:8px;">Kepada Yth.<br>{{tujuan}}<br>di Tempat</p>
<p>Dengan hormat,</p>
<p>Sehubungan dengan akan diselenggarakannya <b>{{acara}}</b>, kami mengundang Bapak/Ibu untuk hadir pada:</p>
<div class="tpl-kv"><span class="k">Hari, Tanggal</span><span>: {{hari_tanggal}}</span></div>
<div class="tpl-kv"><span class="k">Waktu</span><span>: {{waktu}}</span></div>
<div class="tpl-kv"><span class="k">Tempat</span><span>: {{tempat}}</span></div>
<div class="tpl-kv"><span class="k">Agenda</span><span>: {{agenda}}</span></div>
<p style="margin-top:10px;">Mengingat pentingnya acara tersebut, kami mengharapkan kehadiran Bapak/Ibu tepat waktu.</p>
<p>Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>
<p style="margin-top:36px;">Hormat kami,</p>
<p style="margin-top:52px;"><b>{{pengirim}}</b></p>`,
  },
];

const CUSTOM_STORAGE_KEY = "roy_custom_templates";

function loadCustomTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Template[];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: Template[]) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(templates));
}

const ACCEPTED_UPLOAD_EXTS = [".docx", ".doc", ".pdf", ".txt"];
const ACCEPTED_UPLOAD_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/pdf",
  "text/plain",
];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Extract plain text from an uploaded document.
 * - .txt: read as UTF-8
 * - .docx/.doc: use mammoth.extractRawText (dynamic import)
 * - .pdf: use pdfjs-dist to extract text content (dynamic import)
 */
async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return await file.text();
  }
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item.str === "string" ? item.str : ""))
        .join(" ");
      parts.push(pageText);
    }
    return parts.join("\n\n");
  }
  throw new Error("Format file tidak didukung.");
}

/**
 * Detect blank-fill patterns in extracted text and convert them to template fields.
 * Patterns: underscores (____), dot-leader (....), square brackets ([...]),
 * and parenthesised placeholders like (nama) or (isi nama).
 */
function detectBlankFields(text: string): {
  fields: TemplateField[];
  body: string;
} {
  const fields: TemplateField[] = [];
  let counter = 0;
  let body = text;

  // Convert plain text to simple HTML paragraphs first
  body = body
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");

  // Pattern 1: underscores (min 3)
  body = body.replace(/_{3,}/g, () => {
    counter++;
    const key = `field_${counter}`;
    fields.push({ key, label: `Kolom ${counter}`, placeholder: "isi di sini" });
    return `{{${key}}}`;
  });

  // Pattern 2: dot-leaders (min 3 dots, not sentence-ending)
  body = body.replace(/\.{3,}/g, () => {
    counter++;
    const key = `field_${counter}`;
    fields.push({ key, label: `Kolom ${counter}`, placeholder: "isi di sini" });
    return `{{${key}}}`;
  });

  // Pattern 3: square-bracket placeholders [isi nama], [____], etc.
  body = body.replace(/\[([^\]]{1,60})\]/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    // Skip if it looks like a formatting instruction, not a blank
    if (/^_+$|^\.+$/.test(trimmed)) {
      counter++;
      const key = `field_${counter}`;
      fields.push({ key, label: `Kolom ${counter}`, placeholder: "isi di sini" });
      return `{{${key}}}`;
    }
    counter++;
    const key = `field_${counter}`;
    const label = trimmed.length > 40 ? `Kolom ${counter}` : trimmed;
    fields.push({ key, label, placeholder: trimmed });
    return `{{${key}}}`;
  });

  // Pattern 4: parenthesised placeholders (nama), (isi ... )
  body = body.replace(/\((nama[^)]*|isi[^)]*|tempat[^)]*|tanggal[^)]*|alamat[^)]*|tanda tangan[^)]*)\)/gi, (_match, inner: string) => {
    counter++;
    const key = `field_${counter}`;
    const trimmed = inner.trim();
    fields.push({ key, label: trimmed.charAt(0).toUpperCase() + trimmed.slice(1), placeholder: trimmed });
    return `{{${key}}}`;
  });

  return { fields, body };
}

function renderPreview(body: string, fields: TemplateField[], formData: Record<string, string>): string {
  let html = body;
  for (const f of fields) {
    const val = (formData[f.key] || "").trim();
    const display = val || f.placeholder;
    const cls = val ? "tpl-blank filled" : "tpl-blank";
    const span = `<span class="${cls}">${display}</span>`;
    html = html.split(`{{${f.key}}}`).join(span);
  }
  return html;
}

const WIZARD_STEPS = [
  { id: 1, label: "Pilih Templat" },
  { id: 2, label: "Isi Data" },
  { id: 3, label: "Selesai" },
] as const;

function TemplatSuratPage() {
  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => loadCustomTemplates());
  const [view, setView] = useState<"gallery" | "editor" | "builder">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("semua");
  const [current, setCurrent] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = useState(1);

  // Builder state
  const [builderName, setBuilderName] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderFields, setBuilderFields] = useState<TemplateField[]>([]);
  const [builderFieldCounter, setBuilderFieldCounter] = useState(0);
  const builderCanvasRef = useRef<HTMLDivElement>(null);

  // Upload state
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const inCat = activeCategory === "semua"
        ? true
        : activeCategory === "custom"
          ? !!t.custom
          : t.category === activeCategory;
      if (!inCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    });
  }, [allTemplates, activeCategory, searchQuery]);

  const showAddNew = activeCategory === "semua" || activeCategory === "custom";

  function selectTemplate(t: Template) {
    setCurrent(t);
    setFormData({});
    setWizardStep(1);
    setView("editor");
  }

  function backToGallery() {
    setView("gallery");
    setCurrent(null);
  }

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  const filledCount = current ? current.fields.filter((f) => (formData[f.key] || "").trim()).length : 0;
  const allFilled = current ? filledCount === current.fields.length : false;

  function downloadPdf() {
    window.print();
  }

  function downloadWord() {
    if (!current) return;
    const preview = document.getElementById("tpl-preview-paper");
    if (!preview) return;
    const content = preview.innerHTML.replace(/class="tpl-blank[^"]*"/g, "");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${current.name}</title></head><body style="font-family:'Times New Roman',serif;font-size:14px;line-height:1.75;">${content}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.name + ".doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("File Word berhasil diunduh.");
  }

  function duplicateTemplate(t: Template) {
    const copy: Template = {
      ...t,
      id: "custom-" + Date.now(),
      name: t.name + " (Salinan)",
      fields: t.fields.map((f) => ({ ...f })),
      body: t.body,
      custom: true,
      category: "custom",
    };
    const updated = [...customTemplates, copy];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    toast.success("Templat disalin — sekarang tinggal kamu sesuaikan.");
    selectTemplate(copy);
  }

  function deleteTemplate(id: string) {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    toast.success("Templat dihapus dari galeri.");
  }

  function openBuilder() {
    setBuilderName("");
    setBuilderDesc("");
    setBuilderFields([]);
    setBuilderFieldCounter(0);
    setView("builder");
  }

  function cancelBuilder() {
    setView("gallery");
  }

  // ===== UPLOAD FLOW =====
  const handleUploadFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    const extOk = ACCEPTED_UPLOAD_EXTS.some((ext) => name.endsWith(ext));
    const typeOk = ACCEPTED_UPLOAD_TYPES.includes(file.type);
    if (!extOk && !typeOk) {
      toast.error("Format tidak didukung. Gunakan .docx, .doc, .pdf, atau .txt");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Ukuran file melebihi 10MB.");
      return;
    }

    setUploadProcessing(true);
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        toast.error("Tidak ada teks yang bisa dibaca dari file ini.");
        return;
      }

      const { fields, body } = detectBlankFields(text);
      const templateName = file.name.replace(/\.[^.]+$/, "");
      const newTemplate: Template = {
        id: "custom-" + Date.now(),
        name: templateName,
        desc: `Diunggah dari ${file.name}. ${fields.length} kolom isian terdeteksi otomatis.`,
        category: "custom",
        icon: <FileUp className="size-5" />,
        fields: fields.length > 0 ? fields : [{ key: "field_1", label: "Kolom 1", placeholder: "isi di sini" }],
        body: fields.length > 0 ? body : `<p>${text.replace(/\n\s*\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
        custom: true,
      };

      const updated = [...customTemplates, newTemplate];
      setCustomTemplates(updated);
      saveCustomTemplates(updated);
      toast.success(`Templat "${templateName}" ditambahkan. ${fields.length} kolom isian terdeteksi otomatis.`);
      selectTemplate(newTemplate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses file.";
      toast.error(msg);
    } finally {
      setUploadProcessing(false);
    }
  }, [customTemplates]);

  function handleUploadDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  }

  function handleUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = "";
  }

  function markSelectionAsField() {
    const canvas = builderCanvasRef.current;
    if (!canvas) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      toast.error("Blok teks di area surat dulu, lalu klik tombol ini.");
      return;
    }
    const range = sel.getRangeAt(0);
    if (!canvas.contains(range.commonAncestorContainer)) {
      toast.error("Blok teks di dalam area surat dulu, lalu klik tombol ini.");
      return;
    }
    const text = range.toString().trim();
    const counter = builderFieldCounter + 1;
    const key = "field_" + counter;
    const span = document.createElement("span");
    span.className = "tpl-builder-blank";
    span.setAttribute("data-field", key);
    span.textContent = text || "isi di sini";
    if (text) range.deleteContents();
    range.insertNode(span);
    sel.removeAllRanges();
    setBuilderFieldCounter(counter);
    setBuilderFields((prev) => [...prev, { key, label: "Kolom " + counter, placeholder: text || "contoh isian" }]);
    toast.success("Kolom isian ditambahkan.");
  }

  function updateBuilderField(key: string, prop: "label" | "placeholder", value: string) {
    setBuilderFields((prev) => prev.map((f) => (f.key === key ? { ...f, [prop]: value } : f)));
  }

  function removeBuilderField(key: string) {
    const canvas = builderCanvasRef.current;
    if (canvas) {
      const span = canvas.querySelector(`[data-field="${key}"]`);
      if (span) span.replaceWith(document.createTextNode(span.textContent || ""));
    }
    setBuilderFields((prev) => prev.filter((f) => f.key !== key));
  }

  function saveBuilder() {
    if (!builderName.trim()) {
      toast.error("Isi nama templat terlebih dahulu.");
      return;
    }
    const canvas = builderCanvasRef.current;
    if (!canvas) return;
    const clone = canvas.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-field]").forEach((span) => {
      const key = span.getAttribute("data-field");
      span.replaceWith(document.createTextNode(`{{${key}}}`));
    });
    const newTemplate: Template = {
      id: "custom-" + Date.now(),
      name: builderName.trim(),
      desc: builderDesc.trim() || "Templat buatan sendiri.",
      category: "custom",
      icon: <FileEdit className="size-5" />,
      fields: builderFields.map((f) => ({ key: f.key, label: f.label || f.key, placeholder: f.placeholder || "..." })),
      body: clone.innerHTML,
      custom: true,
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    cancelBuilder();
    toast.success(`Templat "${newTemplate.name}" ditambahkan ke galeri.`);
  }

  // ===== EDITOR VIEW (wizard) =====
  if (view === "editor" && current) {
    return (
      <div>
        {/* Wizard progress bar */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={backToGallery} className="mr-2">
              <ArrowLeft className="size-4" /> Ganti Templat
            </Button>
            <div className="flex flex-1 items-center gap-1.5">
              {WIZARD_STEPS.map((s, i) => (
                <div key={s.id} className="flex flex-1 items-center gap-1.5">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                      wizardStep === s.id
                        ? "bg-primary text-primary-foreground"
                        : wizardStep > s.id
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {wizardStep > s.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="flex size-5 items-center justify-center rounded-full bg-current/20 text-[10px]">
                        {s.id}
                      </span>
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={cn("h-0.5 flex-1 rounded-full", wizardStep > s.id ? "bg-success" : "bg-border")} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="page-head-icon">
              {current.icon}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{current.name}</h2>
              <p className="text-xs text-slate">{current.desc}</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            {filledCount}/{current.fields.length} terisi
          </Badge>
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* Form panel */}
          <Card className="lg:sticky lg:top-20 h-fit task-card-mockup !p-5">
            <CardContent className="space-y-4 p-0">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Pencil className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Isi Data Surat</h3>
              </div>
              {current.fields.map((f) => {
                const filled = !!(formData[f.key] || "").trim();
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className={cn("flex items-center gap-1.5 text-xs", filled && "text-success")}>
                      {filled && <Check className="size-3" />}
                      {f.label}
                    </Label>
                    <Input
                      placeholder={f.placeholder}
                      value={formData[f.key] || ""}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      className={cn(filled && "border-success/40 bg-success/5")}
                    />
                  </div>
                );
              })}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Preview di sebelah kanan otomatis terisi. Bagian yang belum kamu isi akan tetap ditandai putus-putus.
              </div>

              {wizardStep === 1 && (
                <Button
                  className="btn-action-mockup"
                  onClick={() => setWizardStep(2)}
                  disabled={false}
                >
                  Lanjut ke Selesai
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Preview panel */}
          <div className="flex justify-center rounded-xl bg-paper p-6">
            <div
              id="tpl-preview-paper"
              className="tpl-paper max-w-[560px] min-h-[600px] w-full bg-white px-11 py-12 shadow-lg"
              style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "14px", lineHeight: "1.75", color: "#1c1c1c" }}
              dangerouslySetInnerHTML={{ __html: renderPreview(current.body, current.fields, formData) }}
            />
          </div>
        </div>

        {/* Download bar — appears at wizard step 2 */}
        {wizardStep === 2 && (
          <div className="mt-6">
            <div className={cn("status-banner mb-4", !allFilled && "opacity-70")}>
              <Check className="size-4" />
              {allFilled
                ? "Semua kolom sudah terisi! Surat siap diunduh."
                : `Masih ada ${current.fields.length - filledCount} kolom yang belum terisi. Surat tetap bisa diunduh — bagian kosong akan ditandai putus-putus.`}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn-action-mockup btn-action-download" onClick={downloadPdf}>
                <Download className="size-4" />
                Unduh PDF
              </button>
              <button className="btn-secondary-line" onClick={downloadWord}>
                <FileType2 className="size-4" />
                Unduh Word (.doc)
              </button>
              <button className="btn-outline-navy" onClick={() => setWizardStep(1)}>
                <ArrowLeft className="size-4" />
                Kembali Isi Data
              </button>
            </div>
          </div>
        )}

        <style>{`
          .tpl-kv { display: flex; gap: 6px; margin: 2px 0; }
          .tpl-kv .k { width: 180px; flex-shrink: 0; }
          .tpl-blank { display: inline-block; min-width: 70px; border-bottom: 1.5px dashed var(--gold, #C79A46); padding: 0 3px; color: var(--slate-light, #8892A0); font-style: italic; }
          .tpl-blank.filled { border-bottom: 1.5px solid var(--navy-700, #25375A); color: #1c1c1c; font-weight: 600; font-style: normal; background: rgba(199,154,70,.1); }
          @media print {
            body * { visibility: hidden; }
            #tpl-preview-paper, #tpl-preview-paper * { visibility: visible; }
            #tpl-preview-paper { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none; padding: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ===== BUILDER VIEW =====
  if (view === "builder") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={cancelBuilder}>
            <ArrowLeft className="size-4" /> Batal
          </Button>
          <div className="flex items-center gap-3">
            <div className="page-head-icon">
              <FileEdit className="size-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Buat Templat Baru</h2>
          </div>
          <Button size="sm" onClick={saveBuilder}>
            <Check className="size-4" /> Simpan Templat
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit task-card-mockup !p-5">
            <CardContent className="space-y-4 p-0">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Pencil className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Detail Templat</h3>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Templat</Label>
                <Input
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="Surat Keterangan Kerja"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deskripsi Singkat</Label>
                <Input
                  value={builderDesc}
                  onChange={(e) => setBuilderDesc(e.target.value)}
                  placeholder="Untuk menerangkan status kerja karyawan"
                />
              </div>
              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Kolom Isian</h3>
                  <Badge variant="secondary">{builderFields.length}</Badge>
                </div>
                {builderFields.length === 0 ? (
                  <div className="empty-state-mockup">
                    <div className="pip">
                      <Pencil className="size-4" />
                    </div>
                    <p className="mt-2 text-xs">Blok teks pada area surat di sebelah kanan, lalu klik "Tandai sebagai Kolom Isian".</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {builderFields.map((f) => (
                      <div key={f.key} className="rounded-lg border border-border bg-muted/30 p-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <Badge variant="outline" className="font-mono text-[10px]">{f.key}</Badge>
                          <button
                            className="flex size-5 items-center justify-center rounded text-slate-light transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeBuilderField(f.key)}
                          >
                            ×
                          </button>
                        </div>
                        <Input
                          value={f.label}
                          onChange={(e) => updateBuilderField(f.key, "label", e.target.value)}
                          placeholder="Label kolom (mis. Nama Lengkap)"
                          className="mb-1.5 text-xs"
                        />
                        <Input
                          value={f.placeholder}
                          onChange={(e) => updateBuilderField(f.key, "placeholder", e.target.value)}
                          placeholder="Contoh isian"
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center rounded-xl bg-paper p-6">
            <div className="w-full max-w-[560px]">
              <div className="mb-2.5 flex justify-end">
                <Button variant="outline" size="sm" onClick={markSelectionAsField}>
                  <Pencil className="size-3.5" /> Tandai sebagai Kolom Isian
                </Button>
              </div>
              <div
                ref={builderCanvasRef}
                contentEditable
                suppressContentEditableWarning
                className="tpl-paper min-h-[400px] w-full cursor-text rounded-lg bg-white px-11 py-12 shadow-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "14px", lineHeight: "1.75", color: "#1c1c1c" }}
              >
                <p>Kepada Yth.<br />...</p>
                <p>Dengan hormat,</p>
                <p>Tulis isi surat di sini. Blok teks yang perlu diisi pengguna nanti (misalnya nama, tanggal, alamat), lalu klik tombol "Tandai sebagai Kolom Isian" di atas.</p>
                <p>Hormat kami,</p>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .tpl-builder-blank {
            display: inline-block;
            background: rgba(199,154,70,.18);
            border: 1px dashed #C79A46;
            border-radius: 4px;
            padding: 0 5px;
            color: #8A6A2A;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  // ===== GALLERY VIEW =====
  return (
    <div>
      <PageHeader
        title="Templat Surat Menyurat"
        description="Pilih templat, isi hanya bagian yang kosong — sisanya sudah rapi otomatis. Bisa juga buat templat suratmu sendiri."
        icon={FileEdit}
      />

      {/* ===== UPLOAD ZONE — Cara 1: Upload templat sendiri ===== */}
      <div
        onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
        onDragLeave={() => setUploadDragOver(false)}
        onDrop={handleUploadDrop}
        className={cn(
          "mb-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-7 text-center transition-all sm:p-9",
          uploadDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-paper-dim hover:border-navy-700",
        )}
      >
        <input
          ref={uploadInputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_EXTS.join(",")}
          onChange={handleUploadInput}
          className="hidden"
        />
        <div className="flex size-12 items-center justify-center rounded-xl bg-navy-800">
          {uploadProcessing ? (
            <Loader2 className="size-6 animate-spin text-white" />
          ) : (
            <Upload className="size-6 text-white" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-navy-800">
            {uploadProcessing ? "Memproses templat..." : "Tarik & lepas templat di sini"}
          </h3>
          <p className="mt-0.5 text-xs text-slate">
            Unggah file surat — sistem otomatis mendeteksi bagian kosong dan mengubahnya jadi kolom isian.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploadProcessing}
          >
            <FileUp className="size-4" /> Pilih File
          </Button>
          <div className="flex flex-wrap gap-1.5">
            {ACCEPTED_UPLOAD_EXTS.map((ext) => (
              <Badge key={ext} variant="secondary" className="text-[10px] font-mono">{ext}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ===== BUILDER ZONE — Cara 2: Buat templat dari nol ===== */}
      {showAddNew && (
        <Card className="mb-5 border-dashed border-navy-700 bg-paper-dim">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-800">
              <FileEdit className="size-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-navy-800">Punya templat surat sendiri?</h3>
              <p className="mt-0.5 text-xs text-slate">
                Buat templat dari nol — tulis isi surat, tandai bagian yang perlu diisi, simpan ke galeri.
              </p>
            </div>
            <Button size="sm" onClick={openBuilder}>
              <Plus className="size-4" /> Buat Templat Baru
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-light" />
          <Input
            className="pl-9"
            placeholder="Cari nama atau jenis surat…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category pills with icons */}
      <div className="choice-pills mb-5">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn("choice-pill", activeCategory === c.id && "active")}
            >
              <Icon className="size-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && !showAddNew ? (
        <div className="empty-state-mockup">
          <div className="pip">
            <Search className="size-4" />
          </div>
          <p className="mt-2 text-sm">Tidak ada templat yang cocok. Coba kata kunci atau kategori lain.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {showAddNew && (
            <button
              onClick={openBuilder}
              className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-700 bg-paper-dim p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-paper hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-navy-800">
                <Plus className="size-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-navy-800">Buat Templat Baru</h4>
              <p className="text-xs text-slate">Susun templat suratmu sendiri</p>
            </button>
          )}
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy-700 hover:shadow-md"
              onClick={() => selectTemplate(t)}
            >
              {t.custom && (
                <button
                  className="absolute right-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-md bg-white text-slate-light shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                  title="Hapus templat"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
              <button
                className={cn(
                  "absolute top-2.5 z-10 flex size-6 items-center justify-center rounded-md bg-white text-slate-light shadow-sm transition-colors hover:bg-paper-dim hover:text-navy-800",
                  t.custom ? "right-10" : "right-2.5",
                )}
                onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }}
                title="Jadikan dasar templat baru"
              >
                <Copy className="size-3" />
              </button>
              <div className="task-head-mockup">
                <div className="ic">{t.icon}</div>
                <div className="flex-1">
                  <h4 className="pr-12 text-sm font-bold text-foreground">{t.name}</h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate">{t.desc}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {t.custom && (
                  <Badge className="text-[10px]" variant="outline">Templat Kamu</Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {t.fields.length} bagian untuk diisi
                </Badge>
              </div>
              <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="size-3" />
                Klik untuk mulai mengisi
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
