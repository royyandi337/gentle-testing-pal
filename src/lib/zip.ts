import JSZip from "jszip";
import { downloadBlob } from "./image";

export async function downloadZip(
  files: { name: string; blob: Blob }[],
  zipName: string,
) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}
