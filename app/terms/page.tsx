export const metadata = { title: "Terms of Service — PayoutClear" };

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Last updated: 8 August 2026</p>

      <Section title="The service">
        <p>
          PayoutClear (&ldquo;the app&rdquo;) connects to your Shopify store to reconcile payouts and estimate true
          profit and tax set-aside. It is operated by George Beevor, trading as a sole trader in England. By
          connecting your store, you agree to these terms.
        </p>
      </Section>

      <Section title="Not tax or accounting advice">
        <p>
          Figures shown in the app — tax set-aside estimates, true profit, and any other calculation — are estimates
          to help you plan, not tax, accounting, or legal advice. Talk to a qualified accountant before relying on
          these numbers for filings or business decisions.
        </p>
      </Section>

      <Section title="Trial and billing">
        <p>
          New stores get a 14-day free trial with full access. After the trial, continued access requires an active
          subscription, billed via Stripe. You can view your subscription status and manage or cancel it at any time
          from the app&apos;s Settings screen, which links to Stripe&apos;s own billing portal. If your trial or
          subscription lapses, the app switches to read-only rather than deleting anything — your historical data
          stays intact and is fully restored if you subscribe again.
        </p>
      </Section>

      <Section title="Your responsibilities">
        <ul className="list-disc space-y-1 pl-5">
          <li>Cost-per-product and expense figures you enter are your own responsibility to keep accurate.</li>
          <li>You won&apos;t use the app in a way that violates Shopify&apos;s or Stripe&apos;s own terms.</li>
          <li>You&apos;re responsible for the accuracy of the Shopify store data you connect.</li>
        </ul>
      </Section>

      <Section title="Availability and changes">
        <p>
          We aim for reliable service but don&apos;t guarantee it will be uninterrupted or error-free. Features may
          change as the product develops; we&apos;ll try to give notice of anything that materially reduces what the
          app does for you.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          The app is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, George Beevor isn&apos;t
          liable for indirect or consequential losses arising from your use of the app, including decisions made
          based on figures it shows you.
        </p>
      </Section>

      <Section title="Ending the relationship">
        <p>
          You can stop using the app at any time by uninstalling it from your Shopify admin and cancelling your
          subscription via the billing portal. See our{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>{" "}
          for what happens to your data afterward.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of England and Wales.</p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms: chessli1995@gmail.com.</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
