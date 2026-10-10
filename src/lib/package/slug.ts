export const PACKAGE_SLUG_MAX_LENGTH = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Fantasy Forest & Friends" → "fantasy-forest-friends". */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, PACKAGE_SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/** Static pages under /intimate-celebrations/ on the customer site that a package would shadow. */
const RESERVED_SLUGS = new Set(["booked"]);

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.has(value);
}

/** Lowercase letters and digits separated by single hyphens. */
export function isValidSlug(value: string): boolean {
  return value.length <= PACKAGE_SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}
