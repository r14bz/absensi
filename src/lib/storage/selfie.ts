import { getServiceRoleClient } from "@/lib/supabase/server";
import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "attendance-selfies";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload file selfie ke Supabase Storage (server-side, pakai service role).
 * Return path relatif (mis. `user_id/timestamp.jpg`) untuk disimpan di DB.
 */
export async function uploadSelfieServer(
  userId: string,
  file: Buffer | Uint8Array,
  contentType: string
): Promise<{ path: string | null; error: string | null }> {
  if (!ALLOWED_TYPES.includes(contentType)) {
    return { path: null, error: "Format file tidak didukung (jpg/png/webp)." };
  }
  if (file.length > MAX_FILE_SIZE) {
    return { path: null, error: "Ukuran file maksimal 5MB." };
  }

  const supabase = getServiceRoleClient();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.error("Storage upload error:", error);
    return { path: null, error: "Gagal mengunggah foto." };
  }
  return { path: data.path, error: null };
}

/**
 * Upload file selfie dari browser (client-side, pakai anon key + RLS).
 * Butuh policy storage: user hanya bisa upload ke folder `user_id/`.
 */
export async function uploadSelfieClient(
  userId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { path: null, error: "Format file tidak didukung (jpg/png/webp)." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { path: null, error: "Ukuran file maksimal 5MB." };
  }

  const supabase = getBrowserClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Storage upload error:", error);
    return { path: null, error: "Gagal mengunggah foto." };
  }
  return { path: data.path, error: null };
}

/**
 * Generate signed URL untuk akses private file (valid 1 jam).
 * Dipakai admin/frontend untuk tampilkan foto.
 */
export async function getSelfieSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<{ url: string | null; error: string | null }> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Signed URL error:", error);
    return { url: null, error: "Gagal membuat URL akses." };
  }
  return { url: data.signedUrl, error: null };
}

/**
 * Hapus file selfie (admin/cleanup).
 */
export async function deleteSelfie(path: string): Promise<{ error: string | null }> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Storage delete error:", error);
    return { error: "Gagal menghapus foto." };
  }
  return { error: null };
}

/**
 * Konversi data URL (base64) ke Buffer untuk upload server.
 */
export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1]!;
  const base64 = match[3]!;
  const buffer = Buffer.from(base64, "base64");
  return { buffer, contentType };
}