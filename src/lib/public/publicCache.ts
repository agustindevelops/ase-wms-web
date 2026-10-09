import "server-only";

import { unstable_cache } from "next/cache";

const DEFAULT_PUBLIC_CACHE_SECONDS = 5 * 60;
// Package media URLs are signed for 6 hours; cached responses must expire well before them.
const MAX_PUBLIC_CACHE_SECONDS = 3 * 60 * 60;

/** PUBLIC_CACHE_TIMER in seconds; 0 turns caching off. */
export function publicCacheSeconds(): number {
  const raw = process.env.PUBLIC_CACHE_TIMER?.trim();
  if (!raw) return DEFAULT_PUBLIC_CACHE_SECONDS;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0) {
    return DEFAULT_PUBLIC_CACHE_SECONDS;
  }
  return Math.min(seconds, MAX_PUBLIC_CACHE_SECONDS);
}

/**
 * Next data cache for public reads, so repeated customer-site requests don't
 * reach the database. Arguments are part of the cache key; results must be
 * JSON-serializable.
 */
export function publicCached<Args extends unknown[], Result>(
  load: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tags: string[],
): (...args: Args) => Promise<Result> {
  const seconds = publicCacheSeconds();
  if (seconds === 0) return load;
  return unstable_cache(load, keyParts, { revalidate: seconds, tags });
}
