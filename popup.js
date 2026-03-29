const api = typeof browser !== 'undefined' ? browser : chrome;

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage(message, (response) => {
      const runtimeError = api.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'runtime message failed'));
        return;
      }
      resolve(response || {});
    });
  });
}

async function main() {
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  const selftestBtn = document.getElementById('selftest');
  const extOriginEl = document.getElementById('extorigin');
  const fixCmd = document.getElementById('fixcmd');
  const copyFixBtn = document.getElementById('copyfix');

  const extensionOrigin = `chrome-extension://${api.runtime.id}`;
  extOriginEl.textContent = extensionOrigin;
  const allowOrigins = [
    'http://127.0.0.1:8081',
    'http://localhost:8081',
    'http://127.0.0.1:8082',
    'http://localhost:8082',
    extensionOrigin
  ];
  const fixCommand = `ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '${JSON.stringify(allowOrigins)}'`;
  fixCmd.textContent = fixCommand;

  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const url = tabs?.[0]?.url || '(unknown)';
    status.textContent = `Active tab: ${url}`;
  } catch (error) {
    status.textContent = `Unable to read active tab: ${String(error?.message || error)}`;
  }

  selftestBtn.addEventListener('click', async () => {
    selftestBtn.disabled = true;
    result.textContent = 'Running self-test...';
    try {
      const response = await sendRuntimeMessage({ type: 'MA_KUBO_SELF_TEST' });
      if (!response?.ok) {
        throw new Error(response?.error || 'self-test failed');
      }
      const keyCount = Number(response?.result?.keyCount || 0);
      result.textContent = `Self-test OK. Kubo reachable. Keys: ${keyCount}.`;
    } catch (error) {
      result.textContent = `Self-test failed: ${String(error?.message || error)}`;
    } finally {
      selftestBtn.disabled = false;
    }
  });

  copyFixBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fixCommand);
      result.textContent = 'Fix command copied. Run it in terminal, restart Kubo/IPFS Desktop, then self-test again.';
    } catch (error) {
      result.textContent = `Could not copy command: ${String(error?.message || error)}`;
    }
  });
}

main();
