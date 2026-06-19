self.addEventListener("install", () => {
 console.log("PWA Ready");
});

self.addEventListener("fetch", event => {
 event.respondWith(fetch(event.request));
});
