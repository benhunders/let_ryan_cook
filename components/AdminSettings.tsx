"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Admin = { id: string; email: string | null; full_name: string | null };

export function AdminSettings({
  admins,
  pendingEmails,
  currentUserEmail,
}: {
  admins: Admin[];
  pendingEmails: string[];
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.rpc("add_admin", {
      target_email: value,
    });
    setBusy(false);
    if (e2) {
      setError(e2.message);
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function removeAdmin(target: string) {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.rpc("remove_admin", {
      target_email: target.toLowerCase(),
    });
    setBusy(false);
    if (e2) {
      setError(e2.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8 max-w-xl">
      <form
        onSubmit={addAdmin}
        className="rounded-xl border border-black/10 bg-white p-4"
      >
        <label className="block text-sm font-medium mb-1">
          Add an admin by email
        </label>
        <p className="text-sm text-black/50 mb-3">
          They&apos;ll get chef access automatically when they sign in with this
          Google email — even if they haven&apos;t signed up yet.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ryan@example.com"
            className="flex-1 rounded-md border border-black/15 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand text-white px-4 py-2 font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <section>
        <h2 className="text-lg font-semibold mb-3">Admins</h2>
        <ul className="space-y-2">
          {admins.map((a) => {
            const isSelf =
              !!currentUserEmail &&
              a.email?.toLowerCase() === currentUserEmail.toLowerCase();
            return (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-4 py-2.5"
              >
                <span>
                  <span className="font-medium">
                    {a.full_name ?? a.email}
                  </span>
                  {a.full_name && (
                    <span className="text-black/50"> · {a.email}</span>
                  )}
                  {isSelf && <span className="text-black/40"> (you)</span>}
                </span>
                {a.email && !isSelf && (
                  <button
                    onClick={() => removeAdmin(a.email!)}
                    disabled={busy}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {pendingEmails.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Pending invites</h2>
          <p className="text-sm text-black/50 mb-3">
            Allowlisted but haven&apos;t signed in yet.
          </p>
          <ul className="space-y-2">
            {pendingEmails.map((e) => (
              <li
                key={e}
                className="flex items-center justify-between rounded-lg border border-dashed border-black/15 px-4 py-2.5"
              >
                <span>{e}</span>
                <button
                  onClick={() => removeAdmin(e)}
                  disabled={busy}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
