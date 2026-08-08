import Link from "next/link";

export function LegalFooter() {
  return (
    <p className="px-4 py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
      <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-400">
        Privacy policy
      </Link>
      {" · "}
      <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-400">
        Terms of service
      </Link>
    </p>
  );
}
