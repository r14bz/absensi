"use client";

import { useEffect } from "react";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";

/** Mendaftarkan service worker dan menampilkan install prompt. */
export function PwaRegister() {
  useEffect(() => {
    // Register SW di production (HTTPS / localhost)
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA bersifat opsional; kegagalan tidak boleh mengganggu aplikasi */
    });
  }, []);

  return <PwaInstallPrompt />;
}