import { useEffect, useState, useRef, useCallback } from "react";
import { RotateCw, RotateCcw, X, GripVertical, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfInfo, renderPdfThumbnails, type PdfPageSelection } from "@/lib/pdf";

export type PageItem = {
  id: string;
  fileId: string;
  fileName: string;
  pageIndex: number;
  rotation: number;
  excluded: boolean;
  selected: boolean;
};

type Props = {
  files: File[];
  mode: "merge" | "manage";
  items: PageItem[];
  setItems: (updater: PageItem[] | ((prev: PageItem[]) => PageItem[])) => void;
  selectionMode?: boolean;
  onSelectionChange?: (selectedCount: number) => void;
};

export function PdfThumbnailGrid({ files, mode, items, setItems, selectionMode = false, onSelectionChange }: Props) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ done: number; total: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileIds = useRef(new Map<File, string>());
  const processedFiles = useRef(new Set<File>());

  const getFileId = useCallback((file: File): string => {
    let id = fileIds.current.get(file);
    if (!id) {
      id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      fileIds.current.set(file, id);
    }
    return id;
  }, []);

  // Process only new/removed files incrementally — don't re-render everything
  useEffect(() => {
    const currentFiles = new Set(files);
    const newFiles = files.filter((f) => !processedFiles.current.has(f));
    const removedFiles = [...processedFiles.current].filter((f) => !currentFiles.has(f));

    if (removedFiles.length) {
      for (const file of removedFiles) {
        processedFiles.current.delete(file);
        const fid = fileIds.current.get(file);
        if (fid) {
          setThumbnails((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${fid}-p`)) {
                URL.revokeObjectURL(next[key]);
                delete next[key];
              }
            }
            return next;
          });
          setItems((prev) => prev.filter((item) => item.fileId !== fid));
        }
      }
    }

    if (newFiles.length === 0) {
      return;
    }

    let cancelled = false;
    setRendering(true);
    setRenderProgress({ done: 0, total: newFiles.length });

    (async () => {
      let processed = 0;
      for (const file of newFiles) {
        if (cancelled) return;
        const fileId = getFileId(file);
        try {
          const { pages } = await pdfInfo(file);
          const newItems: PageItem[] = Array.from({ length: pages }, (_, pageIndex) => ({
            id: `${fileId}-p${pageIndex}`,
            fileId,
            fileName: file.name,
            pageIndex,
            rotation: 0,
            excluded: false,
            selected: false,
          }));

          // Show the page grid immediately; thumbnail rendering continues independently.
          if (!cancelled) {
            setItems((prev) => [...prev, ...newItems]);
          }
          processedFiles.current.add(file);

          await renderPdfThumbnails(file, (pageIndex, blob) => {
            if (cancelled) return;
            const itemId = `${fileId}-p${pageIndex}`;
            const url = URL.createObjectURL(blob);
            setThumbnails((prev) => ({ ...prev, [itemId]: url }));
          });
          processed++;
          setRenderProgress({ done: processed, total: newFiles.length });
        } catch (err) {
          console.error("Thumbnail render failed for", file.name, err);
          processedFiles.current.add(file);
          processed++;
          setRenderProgress({ done: processed, total: newFiles.length });
        }
      }

      if (!cancelled) {
        setRenderProgress(null);
        setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Cleanup all thumbnails on unmount
  useEffect(() => {
    return () => {
      setThumbnails((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, []);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(items.filter((item) => item.selected && !item.excluded).length);
    }
  }, [items, onSelectionChange]);

  function rotateItem(id: string, direction: "cw" | "ccw") {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, rotation: (item.rotation + (direction === "cw" ? 90 : 270)) % 360 }
          : item,
      ),
    );
  }

  function toggleExclude(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, excluded: !item.excluded, selected: false } : item,
      ),
    );
  }

  function toggleSelect(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingId && draggingId !== id) {
      setDropTargetId(id);
    }
  }

  function handleDragLeave() {
    setDropTargetId(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    setItems((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggingId);
      const toIndex = prev.findIndex((item) => item.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggingId(null);
    setDropTargetId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  const activeCount = items.filter((item) => !item.excluded).length;
  const selectedCount = items.filter((item) => item.selected && !item.excluded).length;

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
        {rendering ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Merender thumbnail{renderProgress ? ` (${renderProgress.done}/${renderProgress.total} file)` : ""}...
          </span>
        ) : mode === "merge" ? (
          <span className="font-medium text-foreground">
            PDF hasil gabungan: <span className="text-primary">{activeCount} halaman</span>
          </span>
        ) : selectionMode ? (
          <span className="font-medium text-foreground">
            <span className="text-primary">{selectedCount}</span> halaman dipilih untuk diekstrak
          </span>
        ) : (
          <span className="font-medium text-foreground">
            <span className="text-primary">{activeCount}</span> halaman aktif
          </span>
        )}
        {!rendering && mode === "merge" && items.length > activeCount && (
          <span className="text-muted-foreground">
            ({items.length - activeCount} dikecualikan)
          </span>
        )}
      </div>

      {/* Thumbnail grid */}
      <div
        ref={containerRef}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {items.map((item, idx) => {
          const thumb = thumbnails[item.id];
          const isDragging = draggingId === item.id;
          const isDropTarget = dropTargetId === item.id;
          return (
            <div
              key={item.id}
              draggable={!selectionMode}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              onClick={() => selectionMode && toggleSelect(item.id)}
              className={cn(
                "group relative cursor-pointer rounded-lg border-2 bg-white transition-all",
                item.excluded
                  ? "border-dashed border-border opacity-40"
                  : selectionMode && item.selected
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50",
                isDragging && "opacity-30 scale-95",
                isDropTarget && "border-primary border-solid scale-[1.02] shadow-md",
              )}
            >
              {/* Page number badge */}
              <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1">
                {!selectionMode && !item.excluded && (
                  <span className="flex size-5 items-center justify-center rounded bg-navy-800 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                )}
                {selectionMode && !item.excluded && (
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded text-[10px] font-bold transition-colors",
                      item.selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.selected ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                  </span>
                )}
              </div>

              {/* Drag handle */}
              {!selectionMode && !item.excluded && (
                <div className="absolute right-1.5 top-1.5 z-10 cursor-grab text-slate-light opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
                  <GripVertical className="size-3.5" />
                </div>
              )}

              {/* Thumbnail image */}
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-t-md bg-muted/20">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`Halaman ${item.pageIndex + 1}`}
                    className="h-full w-full object-contain"
                    style={{ transform: `rotate(${item.rotation}deg)` }}
                    loading="lazy"
                  />
                ) : (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* File name + page label */}
              <div className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                {mode === "merge" ? (
                  <span className="truncate" title={item.fileName}>
                    {item.fileName}
                  </span>
                ) : (
                  <span>Hal. {item.pageIndex + 1}</span>
                )}
              </div>

              {/* Action buttons overlay */}
              {!rendering && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!item.excluded && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotateItem(item.id, "ccw");
                        }}
                        className="flex size-6 items-center justify-center rounded bg-white/90 text-navy-800 shadow-sm transition-colors hover:bg-white"
                        title="Putar kiri 90°"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rotateItem(item.id, "cw");
                        }}
                        className="flex size-6 items-center justify-center rounded bg-white/90 text-navy-800 shadow-sm transition-colors hover:bg-white"
                        title="Putar kanan 90°"
                      >
                        <RotateCw className="size-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExclude(item.id);
                    }}
                    className={cn(
                      "flex size-6 items-center justify-center rounded shadow-sm transition-colors",
                      item.excluded
                        ? "bg-success text-white hover:bg-success/90"
                        : "bg-white/90 text-destructive hover:bg-white",
                    )}
                    title={item.excluded ? "Kembalikan halaman" : "Hapus halaman ini"}
                  >
                    {item.excluded ? <Eye className="size-3" /> : <X className="size-3" />}
                  </button>
                </div>
              )}

              {/* Excluded overlay */}
              {item.excluded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Dikecualikan
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && !rendering && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {files.length === 0
            ? "Unggah PDF untuk melihat thumbnail halaman."
            : "Tidak ada halaman yang bisa dirender."}
        </div>
      )}
    </div>
  );
}

export function buildSelections(items: PageItem[], files: File[]): PdfPageSelection[] {
  const fileByFileId = new Map<string, File>();
  for (const file of files) {
    const item = items.find((i) => i.fileName === file.name);
    if (item) fileByFileId.set(item.fileId, file);
  }
  return items
    .filter((item) => !item.excluded)
    .map((item) => {
      const file = fileByFileId.get(item.fileId) ?? files.find((f) => f.name === item.fileName)!;
      return {
        file,
        pageIndex: item.pageIndex,
        rotation: item.rotation,
      };
    })
    .filter((selection) => selection.file);
}

export function buildSelectedOnly(items: PageItem[], files: File[]): PdfPageSelection[] {
  const fileByFileId = new Map<string, File>();
  for (const file of files) {
    const item = items.find((i) => i.fileName === file.name);
    if (item) fileByFileId.set(item.fileId, file);
  }
  return items
    .filter((item) => item.selected && !item.excluded)
    .map((item) => {
      const file = fileByFileId.get(item.fileId) ?? files.find((f) => f.name === item.fileName)!;
      return {
        file,
        pageIndex: item.pageIndex,
        rotation: item.rotation,
      };
    })
    .filter((selection) => selection.file);
}
