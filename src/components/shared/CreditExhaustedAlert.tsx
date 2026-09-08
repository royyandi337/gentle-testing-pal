import { Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

const CREDIT_ERROR_PATTERNS = [
  "insufficient credit",
  "credit harian",
  "credit habis",
  "credit.ai",
  "gagal memotong credit",
  "gagal memeriksa credit",
];

export function isCreditError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return CREDIT_ERROR_PATTERNS.some((p) => lower.includes(p));
}

export function CreditExhaustedAlert() {
  const navigate = useNavigate();

  return (
    <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <Zap className="size-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-200">
        Credit AI harian kamu sudah habis
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm text-amber-800 dark:text-amber-300/90">
          Paket harian kamu sudah mencapai batas pemakaian AI. Upgrade ke tier berbayar untuk
          memakai fitur AI tanpa batas, atau tunggu reset credit besok hari.
        </p>
        <Button
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-700"
          onClick={() => navigate({ to: "/akun" })}
        >
          <Zap className="size-3.5" />
          Upgrade Tier
        </Button>
      </AlertDescription>
    </Alert>
  );
}
