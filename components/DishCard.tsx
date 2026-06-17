import Image from "next/image";
import type { Dish } from "@/types/database";
import { ALLERGENS, DIETARY_TAGS, labelFor } from "@/lib/dietary";

// Presentational dish card. Pass interactive controls (stepper, note) as children.
export function DishCard({
  dish,
  rating,
  children,
}: {
  dish: Dish;
  rating?: { avg: number; count: number };
  children?: React.ReactNode;
}) {
  const dietaryTags = dish.dietary_tags ?? [];
  const allergens = dish.allergens ?? [];
  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-black/5">
        {dish.image_url ? (
          <Image
            src={dish.image_url}
            alt={dish.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">
            🍽️
          </div>
        )}
        {!dish.available && (
          <span className="absolute top-2 left-2 rounded bg-black/70 text-white text-xs px-2 py-0.5">
            Sold out
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold leading-snug">{dish.name}</h3>
          {dish.price != null && (
            <span className="text-brand font-semibold whitespace-nowrap">
              ${dish.price.toFixed(2)}
            </span>
          )}
        </div>
        {rating && rating.count > 0 && (
          <p className="text-sm text-amber-600">
            <span aria-hidden>★</span> {rating.avg.toFixed(1)}{" "}
            <span className="text-black/40">
              ({rating.count} rating{rating.count === 1 ? "" : "s"})
            </span>
          </p>
        )}
        {dish.description && (
          <p className="text-sm text-black/60">{dish.description}</p>
        )}
        {dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {dietaryTags.map((v) => (
              <span
                key={v}
                className="rounded-full bg-green-100 text-green-800 text-xs px-2 py-0.5"
              >
                {labelFor(v, DIETARY_TAGS)}
              </span>
            ))}
          </div>
        )}
        {allergens.length > 0 && (
          <p className="text-xs text-amber-700 mt-1">
            <span className="font-medium">Contains:</span>{" "}
            {allergens.map((v) => labelFor(v, ALLERGENS)).join(", ")}
          </p>
        )}
        {children && <div className="mt-auto pt-3">{children}</div>}
      </div>
    </div>
  );
}
