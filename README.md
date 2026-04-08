# ma-extension

Browser extension bridge for `ma-actor` to access local IPFS API without page-origin CORS failures.

## What it does

- Receives bridge requests from the page via `window.postMessage`
- Proxies allowed `POST /api/v0/*` calls to:
  - `http://127.0.0.1:5001`
  - `http://localhost:5001`
- Returns JSON response back to page
- Applies a request-header rewrite rule for extension-origin API calls so IPFS API does not reject `chrome-extension://` origins on strict setups.

## What it cannot do

- A browser extension alone cannot bind and serve an arbitrary local TCP port (for example `:8081`) as a standalone web server.
- For a true local HTTP server on a chosen port, you need a native helper process/app.

## Install from filesystem (no publishing required)

Yes, you can install directly from this folder.

### Chromium/Chrome/Brave/Edge

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder: `ma-extension`

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select `ma-extension/manifest.json`

Note: Firefox temporary add-ons are removed on browser restart unless fully packaged/signed.

## Security policy

- Allowed page origins:
  - localhost/127.0.0.1
  - `*.ipns.localhost`
  - `*.ipfs.localhost`
- Allowed IPFS API bases:
  - `http://127.0.0.1:5001`
  - `http://localhost:5001`
- Allowed IPFS API paths only:
  - `/api/v0/key/list`
  - `/api/v0/key/gen`
  - `/api/v0/name/publish`
  - `/api/v0/name/resolve`
  - `/api/v0/add`
  - `/api/v0/dag/get`
  - `/api/v0/dag/put`
- Query/body validation is enforced per endpoint.

## Risk model

- Low concern: IPFS content add/read workflows.
- Medium concern: key creation and IPNS publish/resolve workflows.
- The extension keeps API scope narrow to the endpoints above and validates inputs before forwarding.

## Development

After editing files, reload the extension in your browser extension page.

## Quick verification

1. Open extension popup.
2. Confirm active tab URL is shown.
3. Click Run IPFS Self-Test.
4. Expect: Self-test OK with key count.

If self-test returns `403`, add the extension origin (`chrome-extension://<extension-id>`) to `API.HTTPHeaders.Access-Control-Allow-Origin` in IPFS config.
The popup includes a ready-to-copy `ipfs config --json ...` command for this.
