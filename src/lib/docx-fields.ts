/**
 * DOCX blank-field auto-detection.
 *
 * Reads a .docx (OOXML) file, scans every run text for blank placeholder
 * segments (`...` / `___` / `…`), replaces each one with a unique token
 * ({{FIELD_1}}, {{FIELD_2}}, ...) and returns both the tokenised docx and a
 * structured field list with auto-suggested labels.
 *
 * Runs fully client-side (jszip + DOMParser).
 */

export type DetectedFieldType = "text" | "date" | "textarea" | "signature";

export type FieldLocation = {
  /** Global block index in document order. */
  blockIndex: number;
  paragraphIndex?: number;
  tableIndex?: number;
  rowIndex?: number;
  cellIndex?: number;
  /** Character offset of the placeholder inside the paragraph text. */
  charOffset?: number;
};

export type DetectedField = {
  token: string;
  autoSuggestedLabel: string;
  fieldType: DetectedFieldType;
  contextHint: string;
  positionOrder: number;
  locationType: "paragraph" | "table_cell";
  locationRef: FieldLocation & { extraTokens?: string[] };
  /** Raw text of the line the placeholder was found on. */
  lineText: string;
  /** Tokens merged into this field (multi-line continuation). */
  mergedTokens: string[];
};

export type DetectionResult = {
  fields: DetectedField[];
  /** Tokenised .docx bytes, ready to be stored as the processed template. */
  processedDocx: Blob;
  /** Plain-text preview of the tokenised document. */
  preview: string;
};

const PLACEHOLDER_RE = /(?:\.\s?){3,}|_{3,}|…+/g;
const SIGNATURE_RE = /\(\s*(?:(?:\.\s?){3,}|_{3,}|…+)\s*\)/;

const XML_NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

type ParaInfo = {
  el: Element;
  texts: Element[];
  text: string;
  isBold: boolean;
  location: FieldLocation;
  locationType: "paragraph" | "table_cell";
};

function textOf(paragraph: Element): { texts: Element[]; text: string } {
  const texts = Array.from(paragraph.getElementsByTagName("w:t"));
  return { texts, text: texts.map((t) => t.textContent ?? "").join("") };
}

function paragraphIsBold(paragraph: Element): boolean {
  const runs = Array.from(paragraph.getElementsByTagName("w:r"));
  if (runs.length === 0) return false;
  return runs.every((run) => {
    const props = run.getElementsByTagName("w:rPr")[0];
    if (!props) return false;
    return props.getElementsByTagName("w:b").length > 0;
  });
}

/** Replace character ranges inside a paragraph's w:t nodes. */
function spliceParagraph(
  texts: Element[],
  edits: Array<{ start: number; end: number; replacement: string }>,
) {
  if (edits.length === 0) return;
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let cursor = 0;
  const nodes = texts.map((node) => {
    const value = node.textContent ?? "";
    const entry = { node, start: cursor, end: cursor + value.length, value };
    cursor += value.length;
    return entry;
  });

  for (const entry of nodes) {
    let out = "";
    let pos = entry.start;
    while (pos < entry.end) {
      const edit = sorted.find((e) => e.start <= pos && e.end > pos);
      if (edit) {
        // Emit replacement only once, at the node holding the edit start.
        if (edit.start >= entry.start && out.indexOf(edit.replacement) === -1) {
          out += edit.replacement;
        }
        pos = Math.min(edit.end, entry.end);
        continue;
      }
      const nextEdit = sorted.find((e) => e.start > pos);
      const stop = nextEdit ? Math.min(nextEdit.start, entry.end) : entry.end;
      out += entry.value.slice(pos - entry.start, stop - entry.start);
      pos = stop;
    }
    if (out !== entry.value) {
      entry.node.textContent = out;
      entry.node.setAttribute("xml:space", "preserve");
    }
  }
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/^[\s\-–—•*\d.)\]]+/, "")
    .replace(/[\s:.,;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function guessType(label: string, fallback: DetectedFieldType): DetectedFieldType {
  const lower = label.toLowerCase();
  if (/tanggal|tgl|tahun|hari\b/.test(lower)) return "date";
  return fallback;
}

/** Label from the text right before the placeholder, on the same line/segment. */
function suggestLabel(segmentBefore: string): string {
  const colonIndex = segmentBefore.lastIndexOf(":");
  const candidate = colonIndex >= 0 ? segmentBefore.slice(0, colonIndex) : segmentBefore;
  // For "Dibuat di : ... Pada tanggal :" style, only the trailing phrase matters.
  const tail = candidate.split(/[.,;]\s|\s{2,}/).pop() ?? candidate;
  return cleanLabel(tail);
}

function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (PLACEHOLDER_RE.test(trimmed)) {
    PLACEHOLDER_RE.lastIndex = 0;
    return false;
  }
  const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

export async function detectDocxFields(file: File | Blob): Promise<DetectionResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) throw new Error("File .docx tidak valid (word/document.xml tidak ditemukan).");
  const xml = await documentEntry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Gagal membaca isi file .docx.");
  }

  const body = doc.getElementsByTagNameNS(XML_NS_W, "body")[0] ?? doc.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("File .docx tidak memiliki isi dokumen.");

  // ---- Flatten body into an ordered list of paragraphs (incl. table cells) ----
  const paragraphs: ParaInfo[] = [];
  let blockIndex = 0;
  let paragraphIndex = 0;
  let tableIndex = 0;

  for (const child of Array.from(body.children)) {
    const tag = child.tagName;
    if (tag === "w:p") {
      const { texts, text } = textOf(child);
      paragraphs.push({
        el: child,
        texts,
        text,
        isBold: paragraphIsBold(child),
        location: { blockIndex: blockIndex++, paragraphIndex: paragraphIndex++ },
        locationType: "paragraph",
      });
    } else if (tag === "w:tbl") {
      const currentTable = tableIndex++;
      const rows = Array.from(child.children).filter((n) => n.tagName === "w:tr");
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.children).filter((n) => n.tagName === "w:tc");
        cells.forEach((cell, cellIndex) => {
          const cellParagraphs = Array.from(cell.children).filter((n) => n.tagName === "w:p");
          cellParagraphs.forEach((para) => {
            const { texts, text } = textOf(para);
            paragraphs.push({
              el: para,
              texts,
              text,
              isBold: paragraphIsBold(para),
              location: {
                blockIndex: blockIndex++,
                tableIndex: currentTable,
                rowIndex,
                cellIndex,
              },
              locationType: "table_cell",
            });
          });
        });
      });
    } else {
      blockIndex++;
    }
  }

  // ---- Detect placeholders ----
  const fields: DetectedField[] = [];
  let tokenCounter = 0;
  let lastHeading = "";
  let lastLabeledField: DetectedField | null = null;
  let openTextarea: DetectedField | null = null;

  const nextToken = () => `{{FIELD_${++tokenCounter}}}`;

  for (const para of paragraphs) {
    const text = para.text;
    PLACEHOLDER_RE.lastIndex = 0;
    const matches = Array.from(text.matchAll(PLACEHOLDER_RE));

    if (matches.length === 0) {
      if (looksLikeHeading(text) || (para.isBold && text.trim())) lastHeading = text.trim();
      if (text.trim()) {
        // Any real content breaks a continuation / freetext block.
        lastLabeledField = null;
        openTextarea = null;
      }
      continue;
    }

    const nonPlaceholder = text.replace(PLACEHOLDER_RE, "").replace(/[\s.:()]/g, "");
    const dotsOnly = nonPlaceholder.length === 0;

    // ---- Pattern 2 & 4: line made only of dots ----
    if (dotsOnly) {
      const edits: Array<{ start: number; end: number; replacement: string }> = [];
      if (lastLabeledField) {
        // continuation of the previous labelled field -> same field, extra line cleared
        for (const m of matches) {
          edits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, replacement: "" });
        }
        lastLabeledField.mergedTokens.push(`line@${para.location.blockIndex}`);
        spliceParagraph(para.texts, edits);
        continue;
      }
      if (openTextarea) {
        for (const m of matches) {
          edits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, replacement: "" });
        }
        openTextarea.mergedTokens.push(`line@${para.location.blockIndex}`);
        spliceParagraph(para.texts, edits);
        continue;
      }
      // start a new freetext (textarea) field
      const token = nextToken();
      const label = lastHeading
        ? `Isian ${titleCase(lastHeading)}`
        : `Isian Bebas ${fields.length + 1}`;
      const field: DetectedField = {
        token,
        autoSuggestedLabel: label,
        fieldType: "textarea",
        contextHint: lastHeading || "Blok isian bebas",
        positionOrder: fields.length,
        locationType: para.locationType,
        locationRef: { ...para.location, charOffset: matches[0]?.index ?? 0 },
        lineText: text.trim(),
        mergedTokens: [],
      };
      fields.push(field);
      openTextarea = field;
      const first = matches[0]!;
      edits.push({
        start: first.index ?? 0,
        end: (first.index ?? 0) + first[0].length,
        replacement: token,
      });
      for (const m of matches.slice(1)) {
        edits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, replacement: "" });
      }
      spliceParagraph(para.texts, edits);
      continue;
    }

    // ---- Pattern 1, 3 & 5: labelled placeholders on this line ----
    openTextarea = null;
    const edits: Array<{ start: number; end: number; replacement: string }> = [];
    let previousEnd = 0;
    let lastOnLine: DetectedField | null = null;

    for (const match of matches) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = text.slice(previousEnd, start);
      const after = text.slice(end, end + 2);

      const isSignature =
        /\($/.test(before.trimEnd()) || SIGNATURE_RE.test(text.slice(Math.max(0, start - 2), end + 2));

      let label: string;
      let fieldType: DetectedFieldType;
      let hint: string;

      if (isSignature && !before.includes(":")) {
        label = lastHeading
          ? `Nama Penanda Tangan (${titleCase(lastHeading)})`
          : "Nama Penanda Tangan";
        fieldType = "signature";
        hint = lastHeading || "Area tanda tangan";
      } else {
        const suggested = suggestLabel(before);
        label = suggested || (lastHeading ? `Isian ${titleCase(lastHeading)}` : `Kolom ${tokenCounter + 1}`);
        fieldType = guessType(label, "text");
        hint = text.trim();
      }

      const token = nextToken();
      const field: DetectedField = {
        token,
        autoSuggestedLabel: label,
        fieldType,
        contextHint: hint,
        positionOrder: fields.length,
        locationType: para.locationType,
        locationRef: { ...para.location, charOffset: start },
        lineText: text.trim(),
        mergedTokens: [],
      };
      fields.push(field);
      lastOnLine = field;
      edits.push({ start, end, replacement: token });
      previousEnd = end;
      void after;
    }

    spliceParagraph(para.texts, edits);
    // Only a trailing placeholder can be continued on the next line.
    lastLabeledField =
      lastOnLine && text.slice(previousEnd).replace(/[\s.]/g, "") === "" ? lastOnLine : null;
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", serialized);
  const processedDocx = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const preview = paragraphs.map((p) => textOf(p.el).text).join("\n");

  return { fields, processedDocx, preview };
}

/** Fill a tokenised template docx with values keyed by token. */
export async function fillDocxTemplate(
  processed: Blob | ArrayBuffer,
  values: Record<string, string>,
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const buffer = processed instanceof Blob ? await processed.arrayBuffer() : processed;
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Templat tidak valid.");
  let xml = await entry.async("string");
  for (const [token, value] of Object.entries(values)) {
    const escaped = (value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    xml = xml.split(token).join(escaped);
  }
  // Clear any token left unfilled.
  xml = xml.replace(/\{\{FIELD_\d+\}\}/g, "");
  zip.file("word/document.xml", xml);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
