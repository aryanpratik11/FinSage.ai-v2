import Image from "next/image";
import Link from "next/link";

/** The sage figure on a mint tile — used as the assistant avatar and app icon. */
export function SageMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 shadow-sm ring-1 ring-brand-100 ${className}`}
      aria-hidden
    >
      <Image src="/brand/logo-mark.png" alt="" width={272} height={256} className="h-[82%] w-auto" />
    </span>
  );
}

/** Full wordmark. Use `dark` on dark-green surfaces to get the light version. */
export function Logo({ dark = false, className = "h-9" }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" className="flex items-center" aria-label="FinSage.ai home">
      <Image
        src={dark ? "/brand/logo-full-light.png" : "/brand/logo-full.png"}
        alt="FinSage.ai"
        width={624}
        height={200}
        priority
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
