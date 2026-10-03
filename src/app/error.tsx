"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Terjadi kesalahan</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Silakan coba lagi. Jika berulang, hubungi admin.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Coba lagi</button>
    </main>
  );
}
