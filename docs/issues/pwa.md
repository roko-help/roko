# Add PWA manifest for mobile Add to Home Screen

## Current state

The site works in a browser but can't be installed as a PWA. No manifest, no service worker.

## Desired state

Users can "Add to Home Screen" on iOS and Android and get an app-like experience – standalone window, custom icon, offline access to static assets.

## Implementation

### 1. Create manifest.json

```json
{
  "name": "Roko – Check before you send",
  "short_name": "Roko",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0e1117",
  "theme_color": "#0e1117",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 2. Add icons

Create 192x192 and 512x512 PNG icons from the raccoon emoji or a custom logo. Place in `public/`.

### 3. Register in index.html

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0e1117">
```

### 4. Service worker

Create `public/sw.js` with a cache-first strategy for static assets (HTML, CSS, images) and network-first for API calls (the checker must always use fresh data).

```javascript
const CACHE = 'roko-v1';
const STATIC = ['/', '/index.html', '/quest.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.') || e.request.url.includes('dns.google')) {
    return; // don't cache API calls
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

Register in index.html:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## Files to change

- `public/manifest.json` – new file
- `public/sw.js` – new file
- `public/index.html` – add manifest link, meta tag, SW registration
- `public/icon-192.png`, `public/icon-512.png` – new files (need design)
