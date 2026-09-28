import { startSharingPage } from './sharing-client.mjs';
import { endpoint, nativeScheme } from './sharing-config.mjs';
startSharingPage({ window, document, fetch: window.fetch.bind(window), endpoint, nativeScheme });
