import Image from "next/image";
import type { Dish } from "@/types/database";

// Presentational dish card. Pass interactive controls (stepper, note) as children.
export function DishCard({
  dish,
  children,
}: {
  dish: Dish;
  children?: React.ReactNode;
}) {
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
        {dish.description && (
          <p className="text-sm text-black/60">{dish.description}</p>
        )}
        {children && <div className="mt-auto pt-3">{children}</div>}
      </div>
    </div>
  );
}
