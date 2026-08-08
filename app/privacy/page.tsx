export const metadata = { title: "Privacy Policy — PayoutClear" };

// NOTE: bracketed [placeholders] are business/legal details (registered
// entity, address, governing jurisdiction, contact address) that need to
// be filled in by the operator before this page is relied on for real —
// left as placeholders rather than invented.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Last updated: [date]</p>

      <Section title="Who we are">
        <p>
          PayoutClear (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by [legal entity name], [registered address].
          For any privacy question or request, contact [contact email].
        </p>
      </Section>

      <Section title="What we collect">
        <p>When you connect your Shopify store, we access and store:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Order data (line items, totals, discounts, refunds, customer name/contact/address on the order)</li>
          <li>Shopify Payments payout and balance transaction data (fees, adjustments, deposit amounts)</li>
          <li>Product data, for the cost-per-product figures you enter yourself</li>
        </ul>
        <p className="mt-2">
          We only request the Shopify API scopes needed for the above (orders, products, Shopify Payments payouts) —
          nothing else. When you subscribe, Stripe collects and processes your payment details directly; we never see
          or store your card number.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Solely to reconcile your payouts and show you true profit, tax set-aside estimates, and payout breakdowns —
          the core function of the app. We do not sell your data, and we do not use it to train any model.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>We share data with the following processors, only as needed to run the service:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Shopify</strong> — the source of your order/payout data (Admin API).</li>
          <li><strong>Stripe</strong> — subscription billing and payment processing.</li>
          <li>Our database and hosting providers, to store and run the app.</li>
          <li>An error-monitoring service, to alert us to bugs — this receives error details, not your order data.</li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p>
          For as long as your store is connected. If you uninstall the app, Shopify notifies us (the{" "}
          <code className="text-xs">shop/redact</code> webhook) roughly 48 hours later, and we delete all data tied
          to your store at that point — we don&apos;t hold onto it &ldquo;just in case&rdquo;, but we also
          don&apos;t delete it the instant you uninstall, in case you reconnect.
        </p>
      </Section>

      <Section title="Your rights (GDPR / CCPA)">
        <p>
          You can request a copy of what we hold, or ask us to delete it, at any time — either by uninstalling the
          app (which triggers deletion as above) or by contacting us directly at [contact email]. Where a customer
          of yours asks Shopify to redact their personal data, Shopify forwards that request to us automatically and
          we scrub the identifying fields (name, email, phone, address) from the relevant order records, keeping
          only the financial figures needed for your own reconciliation history.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>We&apos;ll update the date above if this policy changes materially.</p>
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
