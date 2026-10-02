// The catalog API returns category names in English (e.g. "Skin Care").
// This is a presentation-only translation layer for customer-facing nav/
// merchandising UI — it never touches the real category id/name used for
// filtering, links, or API calls, so existing category data is untouched.
const ARABIC_LABELS: Record<string, string> = {
  'Skin Care': 'العناية بالبشرة',
  'Hair Care': 'العناية بالشعر',
  'Body Care': 'العناية بالجسم',
  "Men's Care": 'العناية بالرجال',
  'Bath & Shower': 'الاستحمام والعناية',
  'Gift & Wellness': 'الهدايا والعافية',
};

/** Arabic label for a category's real (English) name — falls back to the
 * raw name for any category not in the known map, rather than guessing. */
export function categoryLabel(name: string): string {
  return ARABIC_LABELS[name] ?? name;
}

// Routines aren't a real backend category (no category_id, separate API),
// but the product-discovery UI treats them as a first-class one via this
// reserved sentinel id — reusing the existing `?category=` query param
// instead of introducing new routing.
export const ROUTINES_CATEGORY_ID = 'routines';
export const ROUTINES_CATEGORY_LABEL = 'الروتين';
