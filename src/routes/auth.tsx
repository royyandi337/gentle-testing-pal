import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { BrandMark } from "@/components/shared/BrandMark";

export const Route = createFileRoute("/auth")({
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
  component: AuthPage,
});

const ASIDE_POINTS = [
  "Pas foto otomatis siap cetak dalam satu alur",
  "Convert & kelola PDF tanpa aplikasi tambahan",
  "Kredit AI harian, upgrade kapan saja",
];

function AuthPage() {
  const navigate = useNavigate();
  const settings = useSiteSettings();
  const siteName = settings.site_name || "ROY DIGITAL SOLUTION";
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error("Email atau kata sandi salah.");
        return;
      }
      toast.success("Berhasil masuk.");
      navigate({ to: "/dashboard" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      setLoading(false);
      if (error) {
        toast.error(
          error.message.includes("already")
            ? "Email sudah terdaftar. Silakan masuk."
            : "Pendaftaran gagal. Silakan coba lagi.",
        );
        return;
      }
      toast.success("Pendaftaran berhasil. Anda dapat langsung masuk.");
      navigate({ to: "/dashboard" });
    }
  }

  async function forgotPassword() {
    if (!email) {
      toast.error("Masukkan email Anda terlebih dahulu.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Gagal mengirim email reset. Silakan coba lagi.");
      return;
    }
    toast.success("Tautan reset kata sandi telah dikirim ke email Anda.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1fr]">
      {/* Navy aside */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0E1B30] p-8 lg:flex md:p-14">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,.09) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(to bottom, black, transparent 80%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 80%)",
          }}
        />
        <div
          className="absolute -right-32 -top-32 size-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(199,154,70,.18), transparent 65%)" }}
        />
        <div className="relative">
          <BrandMark light />
        </div>
        <div className="relative">
          <h2 className="max-w-[380px] font-display text-3xl font-semibold leading-[1.25] text-white">
            Semua alat foto &amp; dokumen dalam satu akun.
          </h2>
          <div className="mt-8 flex flex-col gap-4">
            {ASIDE_POINTS.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-[7px] bg-white/10">
                  <Check className="size-3 text-[#DCE2EC]" strokeWidth={2} />
                </div>
                <span className="text-[14px] leading-relaxed text-[#C3CBDC]">{point}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[12.5px] text-[#8492AC]">© 2026 {siteName}</div>
      </aside>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="mb-6 flex justify-center lg:hidden">
            <BrandMark />
          </Link>

          <h1 className="font-display text-[26px] font-bold text-foreground">
            {mode === "login" ? "Selamat datang kembali" : "Buat akun baru"}
          </h1>
          <p className="mt-2 text-sm text-slate">
            {mode === "login"
              ? "Masuk untuk lanjut mengelola foto dan dokumen Anda."
              : "Daftar untuk mulai menggunakan semua alat foto dan dokumen."}
          </p>

          {/* Segmented control */}
          <div className="mt-7 flex rounded-[11px] p-1" style={{ background: "var(--paper-dim)" }}>
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2.5 text-[13.8px] font-semibold transition ${mode === m ? "bg-card text-foreground shadow-sm" : "text-slate"}`}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {mode === "register" && (
              <div>
                <label htmlFor="reg-name" className="mb-2 block text-[13.2px] font-semibold text-foreground">Nama Lengkap</label>
                <input
                  id="reg-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-[10px] border border-border bg-card px-3.5 py-3 text-[14.5px] text-foreground outline-none transition focus:border-[#25375A]"
                  style={{ boxShadow: "0 0 0 3px rgba(27,42,68,.12)" }}
                  placeholder="Nama lengkap Anda"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-2 block text-[13.2px] font-semibold text-foreground">Email</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-card px-3.5 py-3 text-[14.5px] text-foreground outline-none transition focus:border-[#25375A]"
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="auth-pass" className="mb-2 block text-[13.2px] font-semibold text-foreground">Kata sandi</label>
              <div className="relative flex items-center">
                <input
                  id="auth-pass"
                  type={showPass ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-border bg-card px-3.5 py-3 pr-11 text-[14.5px] text-foreground outline-none transition focus:border-[#25375A]"
                  placeholder="Masukkan kata sandi"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-1.5 flex items-center justify-center rounded-[7px] p-2 text-slate-light transition hover:bg-paper-dim hover:text-slate"
                  aria-label={showPass ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "login" && (
                <div className="mt-2.5 flex justify-end">
                  <button type="button" onClick={forgotPassword} className="text-[13px] font-semibold text-primary hover:underline">
                    Lupa kata sandi?
                  </button>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[11px] bg-primary py-3 text-[14.8px] font-semibold text-primary-foreground transition hover:bg-[#0E1B30] disabled:opacity-60"
            >
              {loading ? <Loader2 className="mx-auto size-4 animate-spin" /> : mode === "login" ? "Masuk" : "Daftar"}
            </button>
          </form>

          <p className="mt-6 text-center text-[13.5px] text-slate">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Daftar gratis" : "Masuk"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
