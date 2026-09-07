import { useEffect, useState, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader as Loader2, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/akun")({
  head: () => ({
    meta: [
      { title: "Akun — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Kelola profil, kata sandi, dan sesi akun ROY DIGITAL SOLUTION Anda.",
      },
      { property: "og:title", content: "Akun — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Kelola profil, kata sandi, dan sesi akun ROY DIGITAL SOLUTION Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AkunPage,
});

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

function AkunPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setFullName(data?.full_name ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profil berhasil diperbarui.");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Ukuran foto melebihi 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Foto profil berhasil diperbarui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changePassword() {
    if (password.length < 6) {
      toast.error("Kata sandi minimal 6 karakter.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setPassword("");
      toast.success("Kata sandi berhasil diubah.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Akun" description="Kelola informasi profil dan keamanan akun Anda." icon={UserIcon} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
            <CardDescription>Nama dan foto yang ditampilkan di aplikasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar section */}
            <div className="flex items-center gap-4">
              <Avatar className="size-20 border-2 border-border">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Foto profil" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploadingAvatar ? "Mengunggah..." : "Ganti Foto"}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG, atau WEBP. Maks 5MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nama lengkap</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap Anda"
              />
            </div>
            <Button onClick={saveProfile} disabled={saving}>
              Simpan profil
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keamanan</CardTitle>
            <CardDescription>Ubah kata sandi atau keluar dari sesi ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi baru</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={changePassword} disabled={saving || !password}>
                Ubah kata sandi
              </Button>
              <Button variant="secondary" onClick={signOut}>
                Keluar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
