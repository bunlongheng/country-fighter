// Minimal hand-written service worker (no build plugin - see next.config.ts
// for why: Next 16's Turbopack production build rejects webpack-based PWA
// plugins). Bump CACHE_VERSION on any shell/flag-set change to bust caches.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `country-fighter-shell-${CACHE_VERSION}`;
const FLAGS_CACHE = `country-fighter-flags-${CACHE_VERSION}`;
const RUNTIME_CACHE = `country-fighter-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, FLAGS_CACHE, RUNTIME_CACHE];

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// The 194 bundled flag codes in public/flags - regenerate with:
// ls public/flags | sed 's/\.png$//'
const FLAG_CODES = [
  "ad", "ae", "af", "ag", "al", "am", "ao", "ar", "at", "au", "az", "ba",
  "bb", "bd", "be", "bf", "bg", "bh", "bi", "bj", "bn", "bo", "br", "bs",
  "bt", "bw", "by", "bz", "ca", "cd", "cf", "cg", "ch", "ci", "cl", "cm",
  "cn", "co", "cr", "cu", "cv", "cy", "cz", "de", "dj", "dk", "dm", "do",
  "dz", "ec", "ee", "eg", "er", "es", "et", "fi", "fj", "fm", "fr", "ga",
  "gb", "gd", "ge", "gh", "gm", "gn", "gq", "gr", "gt", "gw", "gy", "hn",
  "hr", "ht", "hu", "id", "ie", "il", "in", "iq", "ir", "is", "it", "jm",
  "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn", "kp", "kr", "kw", "kz",
  "la", "lb", "lc", "li", "lk", "lr", "ls", "lt", "lu", "lv", "ly", "ma",
  "mc", "md", "me", "mg", "mh", "mk", "ml", "mm", "mn", "mr", "mt", "mu",
  "mv", "mw", "mx", "my", "mz", "na", "ne", "ng", "ni", "nl", "no", "np",
  "nr", "nz", "om", "pa", "pe", "pg", "ph", "pk", "pl", "pt", "pw", "py",
  "qa", "ro", "rs", "ru", "rw", "sa", "sb", "sc", "sd", "se", "sg", "si",
  "sk", "sl", "sm", "sn", "so", "sr", "ss", "st", "sv", "sy", "sz", "td",
  "tg", "th", "tj", "tl", "tm", "tn", "to", "tr", "tt", "tv", "tz", "ua",
  "ug", "us", "uy", "uz", "va", "vc", "ve", "vn", "vu", "ws", "ye", "za",
  "zm", "zw",
];
const FLAG_URLS = FLAG_CODES.map((code) => `/flags/${code}.png`);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(SHELL_URLS);
      const flagsCache = await caches.open(FLAGS_CACHE);
      await flagsCache.addAll(FLAG_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so a broken/stale cache can never brick the
  // app - only fall back to the cached shell when truly offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", response.clone());
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Bundled flag PNGs: cache-first, they're the whole offline asset set.
  if (url.pathname.startsWith("/flags/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FLAGS_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // Hashed build assets + icons: cache-first, safe to cache forever.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // Everything else: try the network, fall back to cache when offline.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        const cache = await caches.open(RUNTIME_CACHE);
        return (await cache.match(request)) || Response.error();
      }
    })()
  );
});
