"use client";

import { useEffect, useState } from "react";

/**
 * Komponen untuk prompt install PWA.
 * Tampilkan banner/undangan install ketika event `beforeinstallprompt` fired.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Cek apakah sudah terinstall (standalone mode)
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true);
    }
  }, []);

  // Check if user dismissed before (must be before early return)
  useEffect(() => {
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        setDismissed(true);
      } else {
        localStorage.removeItem("pwa-install-dismissed");
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent default browser prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show our custom prompt after a delay (user has time to explore)
      setTimeout(() => setShowPrompt(true), 10000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (isInstalled || dismissed || !deferredPrompt || !showPrompt) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    // Don't show again for 7 days
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up"
      role="dialog"
      aria-label="Install aplikasi"
    >
      <div className="card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install Aplikasi Absensi</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tambahkan ke layar utama untuk akses cepat & notifikasi offline.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="btn-primary flex-1 text-sm"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="btn-ghost text-sm"
          >
            Nanti
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// Type untuk beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}