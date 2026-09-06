import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/86 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger />
          <Link to="/dashboard" className="ml-1 hidden font-display text-sm font-semibold tracking-tight text-foreground md:inline">
            {settings.site_name}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <CreditIndicator className="!bg-card !text-foreground !border !border-border" />
            </div>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Mode terang" : "Mode gelap"}
              className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-slate transition hover:bg-paper-dim"
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
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
