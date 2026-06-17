import Link from "next/link";
import { getUser } from "@/lib/auth";
import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

export const dynamic = "force-dynamic";

// Landing page for the password-reset link. The recovery link routes through
// /auth/callback, which exchanges the code for a session before redirecting
// here — so a missing user means an invalid or expired link.
export default async function ResetPasswordPage() {
  const user = await getUser();

  return (
    <div className="max-w-sm mx-auto mt-12 text-center">
      <h1 className="text-2xl font-bold mb-2">Choose a new password</h1>
      {user ? (
        <>
          <p className="text-black/60 mb-6">
            Set a new password for <strong>{user.email}</strong>.
          </p>
          <UpdatePasswordForm />
        </>
      ) : (
        <p className="mt-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-3">
          This reset link is invalid or has expired.{" "}
          <Link href="/login" className="underline">
            Request a new one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
