import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function AkunPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setFullName(data?.full_name ?? "");
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

  return (
    <div>
      <PageHeader title="Akun" description="Kelola informasi profil dan keamanan akun Anda." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
            <CardDescription>Nama yang ditampilkan di aplikasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
