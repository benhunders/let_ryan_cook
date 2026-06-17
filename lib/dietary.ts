// Shared dietary metadata used when tagging dishes (admin) and displaying
// labels (customer). Allergens follow the 14 declared under EU food law
// (Regulation (EU) No 1169/2011); dietary tags are positive descriptors.

export type Tag = { value: string; label: string };

// The 14 major allergens that must be declared on food in the EU/UK.
export const ALLERGENS: Tag[] = [
  { value: "gluten", label: "Gluten" },
  { value: "crustaceans", label: "Crustaceans" },
  { value: "eggs", label: "Eggs" },
  { value: "fish", label: "Fish" },
  { value: "peanuts", label: "Peanuts" },
  { value: "soybeans", label: "Soybeans" },
  { value: "milk", label: "Milk" },
  { value: "tree_nuts", label: "Tree nuts" },
  { value: "celery", label: "Celery" },
  { value: "mustard", label: "Mustard" },
  { value: "sesame", label: "Sesame" },
  { value: "sulphites", label: "Sulphites" },
  { value: "lupin", label: "Lupin" },
  { value: "molluscs", label: "Molluscs" },
];

// Positive dietary descriptors. These describe the dish, not the diner, so
// they carry no privacy sensitivity.
export const DIETARY_TAGS: Tag[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];

// Resolve a stored value to its human label, falling back to the raw value.
export function labelFor(value: string, list: Tag[]): string {
  return list.find((t) => t.value === value)?.label ?? value;
}
