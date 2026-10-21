// Loads config.js fresh on every visit, so new keys show up without waiting for browser caches to expire.
const { CONFIG } = await import(`./config.js?t=${Date.now()}`);
export { CONFIG };
