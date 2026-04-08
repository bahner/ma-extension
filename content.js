(() => {
  const BRIDGE_REQUEST = 'MA_IPFS_BRIDGE_REQUEST';
  const BRIDGE_RESPONSE = 'MA_IPFS_BRIDGE_RESPONSE';
  const BRIDGE_READY = 'MA_IPFS_BRIDGE_READY';
  const RUNTIME_RESPONSE_TIMEOUT_MS = 3500;
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function safePostMessage(payload) {
    try {
      window.postMessage(payload, '*');
    } catch {
      // Ignore: page may be navigating or extension context may be unstable.
    }
  }

  function normalizeBridgeError(message) {
    const text = String(message || '');
    if (text.toLowerCase().includes('extension context invalidated')) {
      return 'Extension was reloaded/updated. Hard-refresh this tab so a new content script is injected.';
    }
    return text || 'Extension bridge unavailable.';
  }

  safePostMessage({
    type: BRIDGE_READY,
    source: 'ma-extension',
    pageOrigin: window.location.origin
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.type !== BRIDGE_REQUEST || !data.requestId) return;

    let responded = false;
    const timer = setTimeout(() => {
      if (responded) return;
      responded = true;
      safePostMessage({
        type: BRIDGE_RESPONSE,
        requestId: data.requestId,
        ok: false,
        error: 'Extension background did not respond in time.'
      });
    }, RUNTIME_RESPONSE_TIMEOUT_MS);

    try {
      api.runtime.sendMessage({
        type: 'MA_IPFS_PROXY',
        payload: {
          ...(data.payload || {}),
          pageOrigin: window.location.origin
        }
      }, (response) => {
        let runtimeErrorMessage = '';
        try {
          runtimeErrorMessage = api.runtime?.lastError?.message || '';
        } catch (runtimeErr) {
          runtimeErrorMessage = normalizeBridgeError(runtimeErr?.message || runtimeErr);
        }

        if (responded) return;
        responded = true;
        clearTimeout(timer);

        if (runtimeErrorMessage) {
          safePostMessage({
            type: BRIDGE_RESPONSE,
            requestId: data.requestId,
            ok: false,
            error: normalizeBridgeError(runtimeErrorMessage)
          });
          return;
        }

        safePostMessage({
          type: BRIDGE_RESPONSE,
          requestId: data.requestId,
          ok: Boolean(response?.ok),
          result: response?.result,
          error: response?.error || ''
        });
      });
    } catch (error) {
      if (responded) return;
      responded = true;
      clearTimeout(timer);
      safePostMessage({
        type: BRIDGE_RESPONSE,
        requestId: data.requestId,
        ok: false,
        error: normalizeBridgeError(error?.message || error || 'runtime.sendMessage failed')
      });
    }
  });
})();
