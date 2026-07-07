"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseImage } from "@/lib/images";

// Dish image picker: upload a file to Supabase Storage OR paste an image URL.
// The "Search images" button is a roadmap placeholder (see lib/imageSearch.ts).
export function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `dishes/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("dish-images")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setUploading(false);
      alert(`Upload failed: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("dish-images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div>
      <div className="relative w-full aspect-[4/3] rounded-md bg-black/5 overflow-hidden mb-2">
        {value ? (
          <Image
            src={value}
            alt=""
            fill
            sizes="200px"
            className="object-cover"
            unoptimized={!isSupabaseImage(value)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-3xl text-black/30">
            🍽️
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <label className="cursor-pointer rounded-md border border-black/15 px-2 py-1 text-center hover:bg-black/5">
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
            disabled={uploading}
          />
        </label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste image URL"
          className="rounded-md border border-black/15 px-2 py-1"
        />
        <button
          type="button"
          disabled
          title="Automatic image search is coming soon"
          className="rounded-md border border-dashed border-black/20 px-2 py-1 text-black/40 cursor-not-allowed"
        >
          🔍 Search images (soon)
        </button>
      </div>
    </div>
  );
}
