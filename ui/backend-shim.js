/**
 * backend-shim.js
 *
 * Shim para permitir que `google.script.run` funcione em páginas estáticas
 * usando um endpoint de backend via fetch.
 *
 * 1) Defina BACKEND_API_URL com a URL do seu Web App do Google Apps Script.
 * 2) Publique o app como "Anyone, even anonymous".
 * 3) O shim cria um fallback para `google.script.run` quando não estiver disponível.
 */

const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbyUvvuE7vBILSUPl-pWoRO95KAa5wJ6ln0E_tboRxqBE3xeYDnVNC4lNj00PXPu5-VH/exec';

function isGASRunAvailable() {
  return typeof google !== 'undefined' && google && google.script && google.script.run;
}

function createGASRunStub() {
  return createGASRunProxy({
    successHandler: null,
    failureHandler: null,
    userObject: null
  });
}

function createGASRunProxy(state) {
  const runner = {
    withSuccessHandler(fn) {
      return createGASRunProxy({ ...state, successHandler: fn });
    },
    withFailureHandler(fn) {
      return createGASRunProxy({ ...state, failureHandler: fn });
    },
    withUserObject(obj) {
      return createGASRunProxy({ ...state, userObject: obj });
    }
  };

  return new Proxy(runner, {
    get(target, prop) {
      if (prop in target) {
        return target[prop].bind(target);
      }

      return async function(...args) {
        if (!BACKEND_API_URL || BACKEND_API_URL.includes('REPLACE_WITH')) {
          const error = new Error('BACKEND_API_URL não configurada no ui/backend-shim.js');
          if (state.failureHandler) state.failureHandler(error);
          return Promise.reject(error);
        }

        try {
          const result = await callBackendFunction(prop, args);
          if (state.successHandler) state.successHandler(result);
          return result;
        } catch (err) {
          if (state.failureHandler) state.failureHandler(err);
          else console.error('[backend-shim] Erro', err);
          throw err;
        }
      };
    }
  });
}

async function callBackendFunction(functionName, args = []) {
  const payload = {
    action: 'runFunction',
    functionName,
    args
  };

  try {
    return await callBackendFunctionFetch(payload);
  } catch (fetchError) {
    console.warn('[backend-shim] fetch falhou, tentando JSONP fallback', fetchError);
    return await callBackendFunctionJSONP(payload);
  }
}

async function callBackendFunctionFetch(payload) {
  const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));
  const response = await fetch(BACKEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Backend HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data && data.status === 'FALHA') {
    throw new Error(data.message || 'Erro no backend');
  }

  return data;
}

function callBackendFunctionJSONP(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `__gas_jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = `${BACKEND_API_URL}?callback=${encodeURIComponent(callbackName)}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
    const script = document.createElement('script');
    let timeoutId;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(result) {
      cleanup();
      if (result && result.status === 'FALHA') {
        reject(new Error(result.message || 'Erro no backend'));
      } else {
        resolve(result);
      }
    };

    script.onerror = function() {
      cleanup();
      reject(new Error('JSONP load failed'));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 10000);

    script.src = url;
    document.head.appendChild(script);
  });
}

if (!isGASRunAvailable()) {
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createGASRunStub();
}
