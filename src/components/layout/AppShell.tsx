import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Menu, Moon, Search, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { CreditIndicator } from "@/components/shared/CreditIndicator";
import { AppSidebar } from "./AppSidebar";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function AppShell({ children }: { children: ReactNode }) {
  const settings = useSiteSettings();
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  function toggleTheme() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    setIsDark(next);
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-8">
          <SidebarTrigger className="icon-btn !h-9 !w-9" aria-label="Buka menu navigasi">
            <Menu className="size-4" />
          </SidebarTrigger>
          <nav className="hidden items-center gap-1.5 text-[12.5px] font-medium text-slate md:flex">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              {settings.site_name.split(" ").slice(0, 2).join(" ") || "ROY DIGITAL"}
            </Link>
            <ChevronRight className="size-3 text-slate-light" />
            <span className="text-foreground">Tools</span>
          </nav>
          <div className="topbar-search hidden md:flex">
            <Search className="size-4" />
            <input aria-label="Cari di riwayat" placeholder="Cari di Riwayat..." />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <CreditIndicator className="credit-chip !border-border !bg-card !text-foreground" />
            </div>
            <button aria-label="Notifikasi" className="icon-btn">
              <Bell className="size-4" />
              <span className="notification-dot" />
            </button>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Mode terang" : "Mode gelap"}
              className="icon-btn"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 pb-20 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3.5">
        {Icon ? (
          <div className="page-head-icon">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="mt-0.5 text-[13.5px] text-slate">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
