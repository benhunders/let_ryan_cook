// Helpers for dish images. Images uploaded through the app live in the
// `dish-images` bucket of our Supabase project; pasted URLs can point anywhere.
// Only our own host is allowlisted for the Next.js image optimizer (an
// unrestricted allowlist would let anyone use the deployment as an image
// proxy), so external URLs render unoptimized.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function isSupabaseImage(url: string): boolean {
  return !!SUPABASE_URL && url.startsWith(SUPABASE_URL);
}

const PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/dish-images/";

// The bucket path of an uploaded image, or null for external URLs.
// e.g. https://xyz.supabase.co/storage/v1/object/public/dish-images/dishes/a.jpg
//      → "dishes/a.jpg"
export function dishImageStoragePath(url: string): string | null {
  if (!isSupabaseImage(url)) return null;
  const idx = url.indexOf(PUBLIC_OBJECT_PREFIX);
  if (idx === -1) return null;
  const path = url.slice(idx + PUBLIC_OBJECT_PREFIX.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}
