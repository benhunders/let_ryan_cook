// ───────────────────────────────────────────────────────────────────────────
// ROADMAP STUB — Automatic dish image search
//
// Goal: when Ryan adds a dish, let him type the dish name and pull back a grid
// of candidate photos to pick from (instead of uploading/pasting a URL by hand).
//
// Planned implementation:
//   1. A Supabase Edge Function `image-search` (keeps the API key server-side)
//      that proxies one of:
//        - Google Programmable Search (Custom Search JSON API, searchType=image)
//        - Unsplash API (/search/photos)
//        - Bing Image Search API
//   2. The function returns a normalized list of { url, thumbnail, alt, source }.
//   3. The ImageUpload component shows the results; selecting one sets the dish's
//      image_url (optionally re-uploading the chosen image into the
//      `dish-images` Storage bucket so we control its lifetime).
//
// Not wired up in the MVP — ImageUpload currently supports file upload + URL paste.
// ───────────────────────────────────────────────────────────────────────────

export interface ImageSearchResult {
  url: string;
  thumbnail: string;
  alt: string;
  source: string;
}

export async function searchDishImages(
  query: string
): Promise<ImageSearchResult[]> {
  throw new Error(
    `Automatic image search ("${query}") is not implemented yet (see lib/imageSearch.ts roadmap).`
  );
}
