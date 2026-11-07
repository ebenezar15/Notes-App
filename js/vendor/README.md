# Vendored libraries

`anthropic-sdk.js` is a browser bundle of the official Anthropic TypeScript SDK
(`@anthropic-ai/sdk`, licence texts in `anthropic-sdk.LICENSE.txt` (Apache 2.0) and `anthropic-sdk.LICENSE-MIT.txt`), built from
`scripts/anthropic-entry.mjs` so the app needs no build step at runtime.

Rebuild after upgrading the SDK:

```bash
npm install
npm run build:sdk
```
