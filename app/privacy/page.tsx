import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Let Him Cook",
};

// NOTE: This is a practical starting template, not legal advice. Replace the
// [bracketed] placeholders (contact details, business name/address) and have it
// reviewed before relying on it for a production service.
export default function PrivacyPage() {
  return (
    <div className="max-w-2xl prose-sm">
      <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-black/50 mb-6">Last updated: 14 June 2026</p>

      <div className="space-y-6 text-[15px] leading-relaxed">
        <section>
          <p>
            This policy explains how Let Him Cook (&ldquo;we&rdquo;) handles
            your personal data when you use this app to view weekly menus and
            place orders. The data controller is{" "}
            <strong>[your name / business]</strong>, contactable at{" "}
            <strong>[your contact email]</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-1">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account info from Google sign-in:</strong> your name,
              email address, and profile picture.
            </li>
            <li>
              <strong>Order data:</strong> the dishes you select, quantities,
              and any notes you add.
            </li>
            <li>
              <strong>Essential cookies:</strong> a login/session cookie so you
              stay signed in. We don&apos;t use analytics, advertising, or
              tracking cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-1">
            Why we use it &amp; legal basis
          </h2>
          <p>
            We use your data to let you sign in, show you the menu, and pass
            your order to the chef. The legal basis is performance of a contract
            (providing the ordering service you requested) and our legitimate
            interest in operating the app.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-1">Who processes your data</h2>
          <p>
            We rely on these processors, who act on our instructions:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase</strong> — database, authentication, and image
              storage.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting.
            </li>
            <li>
              <strong>Google</strong> — sign-in (OAuth).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-1">Retention</h2>
          <p>
            We keep your account and order data for as long as your account
            exists. When you delete your account, your profile and all of your
            orders are permanently removed.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-1">Your rights</h2>
          <p>
            Under the GDPR you can access, correct, export, or delete your data,
            and object to or restrict its processing. You can delete your
            account and all associated data yourself from the{" "}
            <Link href="/account" className="text-brand hover:underline">
              Account
            </Link>{" "}
            page, or contact us at <strong>[your contact email]</strong> for any
            other request. You also have the right to complain to your local
            data protection authority.
          </p>
        </section>
      </div>
    </div>
  );
}
