// @ts-nocheck
import soundcloudCache from '../../src/content/soundcloud_cache.json';

const MAX_TRACKS_PER_REQUEST = 10;
const DEFAULT_CLIENT_ID = 'IM4oDkstWaLZ4D2ZEbz4DykKHSAlPKC6';
const DEFAULT_PROFILE = 'https://soundcloud.com/illwill';
const DEFAULT_SITE = 'https://dj-illwill.com';
const DEFAULT_REDIRECT = 'https://dj-illwill.com/auth/soundcloud/callback';

const normalizeCacheTracks = () => {
  const normalized: Record<string, any> = {};
  const entries = soundcloudCache?.tracks ?? {};
  for (const [url, stats] of Object.entries(entries)) {
    normalized[url] = {
      id: stats?.id ?? null,
      title: stats?.title ?? null,
      plays: typeof stats?.plays === 'number' ? stats.plays : null,
      likes: typeof stats?.likes === 'number' ? stats.likes : null,
      reposts: typeof stats?.reposts === 'number' ? stats.reposts : null,
      last_updated: stats?.last_updated ?? null,
    };
  }
  return normalized;
};

const fetchSoundCloudTracks = async (trackUrls: string[], clientId: string) => {
  const results: Record<string, any> = {};
  const subset = trackUrls.slice(0, MAX_TRACKS_PER_REQUEST);
  for (const trackUrl of subset) {
    try {
      const resolveUrl = `https://api.soundcloud.com/resolve?url=${encodeURIComponent(trackUrl)}&client_id=${clientId}`;
      const response = await fetch(resolveUrl, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const stats = {
        id: data?.id ?? null,
        title: data?.title ?? null,
        plays: typeof data?.playback_count === 'number' ? data.playback_count : null,
        likes:
          typeof data?.likes_count === 'number'
            ? data.likes_count
            : typeof data?.favoritings_count === 'number'
              ? data.favoritings_count
              : null,
        reposts: typeof data?.reposts_count === 'number' ? data.reposts_count : null,
        last_updated: new Date().toISOString(),
      };
      results[trackUrl] = stats;
    } catch (error) {
      // ignore network/credential errors and fall back to cache
    }
  }
  return results;
};

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const trackParams = url.searchParams.getAll('track');
  const bypassCache = url.searchParams.get('fresh') === 'true';
  const cache = caches.default;

  if (!bypassCache) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  let source: 'api' | 'cache' = 'cache';
  let trackData = normalizeCacheTracks();
  const clientId = env?.SOUNDCLOUD_CLIENT_ID ?? DEFAULT_CLIENT_ID;

  if (clientId && trackParams.length) {
    const apiResults = await fetchSoundCloudTracks(trackParams, clientId);
    if (Object.keys(apiResults).length) {
      source = 'api';
      trackData = {
        ...trackData,
        ...apiResults,
      };
    }
  }

  const payload = {
    source,
    generated_at: source === 'api' ? new Date().toISOString() : soundcloudCache?.generated_at ?? null,
    profile: env?.SOUNDCLOUD_PROFILE_URL ?? soundcloudCache?.profile ?? DEFAULT_PROFILE,
    site: env?.PUBLIC_SITE_URL ?? DEFAULT_SITE,
    redirect: env?.SOUNDCLOUD_REDIRECT_URL ?? DEFAULT_REDIRECT,
    totals: soundcloudCache?.totals ?? null,
    tracks: trackData,
  };

  const response = new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 's-maxage=3600',
    },
  });

  if (!bypassCache) {
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      // ignore cache write issues
    }
  }

  return response;
};
