import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function RootNotFound() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // cookies may not be available in all contexts
  }

  let backHref: string;
  let backLabel: string;

  if (session?.type === "child") {
    backHref = "/discover";
    backLabel = "Kembali ke Discovery";
  } else if (session?.type === "user") {
    backHref = "/parent";
    backLabel = "Kembali ke Dashboard";
  } else {
    backHref = "/";
    backLabel = "Kembali ke Beranda";
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-20 font-sans">
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-6">
        <Image
          src="/images/404-mascot.png"
          alt="Kit mascot holding a forbidden sign"
          fill
          className="object-contain"
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-center">
        Tidak ada apa-apa di sini!
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500 max-w-xs">
        Halaman yang kamu cari tidak ada atau sudah dipindahkan.
      </p>

      <div className="mt-8">
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-full bg-[#5794f6] px-8 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[#4a85e8] transition-colors shadow-sm"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
