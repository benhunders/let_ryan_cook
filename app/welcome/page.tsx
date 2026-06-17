import Link from "next/link";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Where the email-confirmation link lands (via /auth/callback). If the code
// exchange signed the user in, we welcome them straight to the menu; otherwise
// we nudge them to sign in.
export default async function WelcomePage() {
  const user = await getUser();

  return (
    <div className="max-w-sm mx-auto mt-12 text-center">
      <div className="text-5xl mb-3">🎉</div>
      <h1 className="text-2xl font-bold mb-2">You&apos;re all set!</h1>
      {user ? (
        <>
          <p className="text-black/60 mb-6">
            Your email is confirmed and you&apos;re signed in
            {user.email ? (
              <>
                {" "}
                as <strong>{user.email}</strong>
              </>
            ) : null}
            . Have a look at this week&apos;s menu and place your order.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            See this week&apos;s menu
          </Link>
        </>
      ) : (
        <>
          <p className="text-black/60 mb-6">
            Your email address is confirmed. Sign in to see this week&apos;s menu
            and place your order.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-black px-5 py-3 font-medium text-white shadow-sm hover:bg-black/85"
          >
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}
