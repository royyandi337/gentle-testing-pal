import { supabase } from "@/integrations/supabase/client";

export type HistoryCategory = "pas-foto" | "pdf" | "word" | "photo";

export const CATEGORY_LABEL: Record<HistoryCategory, string> = {
  "pas-foto": "Pas Foto",
  pdf: "PDF",
  word: "Word",
  photo: "Photo",
};

const BUCKET_BY_CATEGORY: Record<HistoryCategory, string> = {
  "pas-foto": "photos-processed",
  photo: "photos-processed",
  pdf: "documents-processed",
  word: "documents-processed",
};

export type SaveResultInput = {
  category: HistoryCategory;
  tool: string;
  fileName: string;
  blob: Blob;
  settings?: Record<string, unknown>;
};

/**
 * Stores a processed result in Storage (private, per-user folder) and records
 * it in projects + processed_files so it shows up in Riwayat.
 */
export async function saveResult(input: SaveResultInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  const userId = userData.user.id;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: input.fileName,
      category: input.category,
      tool: input.tool,
      status: "completed",
      settings: (input.settings ?? {}) as never,
    })
    .select()
    .single();
  if (projectError) throw projectError;

  const bucket = BUCKET_BY_CATEGORY[input.category];
  const path = `${userId}/${project.id}/${input.fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, input.blob, { contentType: input.blob.type, upsert: true });
  if (uploadError) throw uploadError;

  const { error: fileError } = await supabase.from("processed_files").insert({
    user_id: userId,
    project_id: project.id,
    file_name: input.fileName,
    file_path: `${bucket}/${path}`,
    file_type: input.blob.type,
    file_size: input.blob.size,
  });
  if (fileError) throw fileError;

  return project;
}

export type HistoryRow = {
  id: string;
  name: string;
  category: string;
  tool: string;
  status: string;
  created_at: string;
  file: { file_name: string; file_path: string; file_size: number | null } | null;
};

export async function listHistory(): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,category,tool,status,created_at,processed_files(file_name,file_path,file_size)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const files = (row as unknown as { processed_files?: HistoryRow["file"][] }).processed_files;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      tool: row.tool,
      status: row.status,
      created_at: row.created_at,
      file: files?.[0] ?? null,
    };
  });
}

function splitPath(filePath: string) {
  const idx = filePath.indexOf("/");
  return { bucket: filePath.slice(0, idx), path: filePath.slice(idx + 1) };
}

export async function getSignedUrl(filePath: string) {
  const { bucket, path } = splitPath(filePath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteHistoryItem(projectId: string, filePath?: string | null) {
  if (filePath) {
    const { bucket, path } = splitPath(filePath);
    await supabase.storage.from(bucket).remove([path]);
  }
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}
