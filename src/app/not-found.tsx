import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Alamat yang Anda buka tidak tersedia.</p>
      <Link href="/" className="btn-primary mt-6">Kembali ke beranda</Link>
    </main>
  );
}
