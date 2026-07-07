// Compute average rating + count per dish from a flat list of rating rows.
export function averagesByDish(
  ratings: { dish_id: string; rating: number }[]
): Map<string, { avg: number; count: number }> {
  const sum = new Map<string, { total: number; count: number }>();
  for (const r of ratings) {
    const cur = sum.get(r.dish_id) ?? { total: 0, count: 0 };
    cur.total += r.rating;
    cur.count += 1;
    sum.set(r.dish_id, cur);
  }
  const out = new Map<string, { avg: number; count: number }>();
  for (const [dishId, { total, count }] of sum) {
    out.set(dishId, { avg: total / count, count });
  }
  return out;
}
