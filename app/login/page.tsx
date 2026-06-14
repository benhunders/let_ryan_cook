import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginButton } from "@/components/LoginButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;

  // Already signed in? Skip the login screen.
  const user = await getUser();
  if (user) redirect(next);

  return (
    <div className="max-w-sm mx-auto mt-12 text-center">
      <h1 className="text-2xl font-bold mb-2">Welcome 👋</h1>
      <p className="text-black/60 mb-6">
        Sign in to see this week&apos;s menu and place your order.
      </p>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">
          Sorry, sign-in failed. Please try again.
        </p>
      )}
      <LoginButton next={next} />
    </div>
  );
}
