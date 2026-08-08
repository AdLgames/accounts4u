import { LegalFooter } from "./legal-footer";

export function NotConnected() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-8 text-center text-zinc-500 dark:text-zinc-400">
        <p>This app needs to be opened from within Shopify admin.</p>
      </div>
      <LegalFooter />
    </div>
  );
}
