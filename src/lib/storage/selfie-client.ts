"use client";

import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "attendance-selfies";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  return { path: data.path, error: null }
}