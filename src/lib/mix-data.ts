import rawMixes from '../content/mixes.json';
import curation from '../content/curation.json';
import soundcloudCache from '../content/soundcloud_cache.json';

export type MixStats = {
  plays?: number | null;
  likes?: number | null;
  reposts?: number | null;
  lastUpdated?: string | null;
};

export type MixEntry = (typeof rawMixes)[number] & {
  slug: string;
  canonicalTrackUrl: string;
  tags: string[];
  isLiveSession: boolean;
  isFavorite: boolean;
  stats: MixStats | null;
  artwork?: string | null;
};

const favoriteIds = new Set<string>((curation.favorite_mix_ids ?? []).filter(Boolean));
const pinnedRecentIds = (curation.pinned_recent_ids ?? []).filter(Boolean);
const popularIds = (curation.popular_mix_ids ?? []).filter(Boolean);

const statsMap = new Map<string, MixStats>();
const trackEntries = soundcloudCache?.tracks ?? {};
for (const [url, stats] of Object.entries(trackEntries)) {
  if (!url) continue;
  statsMap.set(url, {
    plays: typeof stats?.plays === 'number' ? stats.plays : null,
    likes: typeof stats?.likes === 'number' ? stats.likes : null,
    reposts: typeof stats?.reposts === 'number' ? stats.reposts : null,
    lastUpdated: stats?.last_updated ?? stats?.lastUpdated ?? null,
  });
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const mixLibrary: MixEntry[] = rawMixes.map((mix) => {
  const slug = mix.id ?? slugify(`${mix.title}-${mix.date}`);
  const canonicalTrackUrl = mix.soundcloud_track_url ?? mix.url;
  const stats = statsMap.get(canonicalTrackUrl) ?? null;
  const tags = mix.tags ?? [];
  const isLiveSession = Boolean(mix.is_live_session || /live session/i.test(mix.title));
  const isFavorite = favoriteIds.has(slug) || tags.includes('favorite');
  return {
    ...mix,
    slug,
    canonicalTrackUrl,
    stats,
    tags,
    isLiveSession,
    isFavorite,
    artwork: mix.artwork ?? null,
  };
});

const sortByDateDesc = (a: MixEntry, b: MixEntry) => {
  const timeA = Date.parse(a.date);
  const timeB = Date.parse(b.date);
  return timeB - timeA;
};

const sortByPopularity = (a: MixEntry, b: MixEntry) => {
  const playsA = typeof a.stats?.plays === 'number' ? a.stats.plays : -1;
  const playsB = typeof b.stats?.plays === 'number' ? b.stats.plays : -1;
  if (playsA !== playsB) return playsB - playsA;
  const likesA = typeof a.stats?.likes === 'number' ? a.stats.likes : -1;
  const likesB = typeof b.stats?.likes === 'number' ? b.stats.likes : -1;
  if (likesA !== likesB) return likesB - likesA;
  return sortByDateDesc(a, b);
};

export const getRecentMixes = (limit = 3) => {
  const pinned = pinnedRecentIds
    .map((slug) => mixLibrary.find((mix) => mix.slug === slug))
    .filter((mix): mix is MixEntry => Boolean(mix));
  const pinnedSlugs = new Set(pinned.map((mix) => mix.slug));
  const remainder = mixLibrary.filter((mix) => !pinnedSlugs.has(mix.slug)).sort(sortByDateDesc);
  return [...pinned, ...remainder].slice(0, limit);
};

export const getPopularMixes = (limit = 3) => {
  if (popularIds.length) {
    const curated = popularIds
      .map((slug) => mixLibrary.find((mix) => mix.slug === slug))
      .filter((mix): mix is MixEntry => Boolean(mix));
    if (curated.length) {
      return typeof limit === 'number' ? curated.slice(0, limit) : curated;
    }
  }
  const sorted = [...mixLibrary].sort(sortByPopularity);
  return sorted.slice(0, limit);
};

export const getFavoriteMixes = (limit?: number) => {
  const favorites = mixLibrary.filter((mix) => mix.isFavorite);
  favorites.sort(sortByDateDesc);
  return typeof limit === 'number' ? favorites.slice(0, limit) : favorites;
};

export const getLiveMixes = (limit?: number) => {
  const lives = mixLibrary.filter((mix) => mix.isLiveSession).sort(sortByDateDesc);
  return typeof limit === 'number' ? lives.slice(0, limit) : lives;
};

const aggregatedStats = mixLibrary.reduce(
  (acc, mix) => {
    if (typeof mix.stats?.plays === 'number') acc.plays += mix.stats.plays;
    if (typeof mix.stats?.likes === 'number') acc.likes += mix.stats.likes;
    return acc;
  },
  { plays: 0, likes: 0 }
);

const totalsFromCache = soundcloudCache?.totals ?? {};

export const soundcloudTotals = {
  plays:
    typeof totalsFromCache.plays === 'number'
      ? totalsFromCache.plays
      : aggregatedStats.plays > 0
        ? aggregatedStats.plays
        : null,
  likes:
    typeof totalsFromCache.likes === 'number'
      ? totalsFromCache.likes
      : aggregatedStats.likes > 0
        ? aggregatedStats.likes
        : null,
  mixes:
    typeof totalsFromCache.mixes === 'number' ? totalsFromCache.mixes : mixLibrary.length,
};

export const soundcloudProfile =
  soundcloudCache?.profile ?? soundcloudCache?.links?.profile ?? null;

export { mixLibrary };
