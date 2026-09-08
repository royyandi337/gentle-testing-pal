import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/image";

export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  files,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  files?: File[];
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length) onFiles(multiple ? dropped : dropped.slice(0, 1));
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:border-primary/60",
        )}
      >
        <UploadCloud className="size-7 text-primary" />
        <p className="text-sm font-medium">Tarik &amp; lepas file di sini, atau klik untuk pilih</p>
        <p className="text-xs text-muted-foreground">{hint ?? accept}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onFiles(picked);
            e.target.value = "";
          }}
        />
      </div>
      {files && files.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
            >
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
