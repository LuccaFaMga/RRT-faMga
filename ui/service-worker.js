/**
 * ============================================================================
 * SERVICE WORKER - SUPORTE OFFLINE PARA SISTEMA FA-RRT
 * ============================================================================
 * Funcionalidades:
 * - Cache de recursos estáticos (app shell)
 * - Sincronização em background
 * - Queue de dados pendentes
 * - Reconexão automática
 * ============================================================================
 */

// ========================================================= //
// GUARD: Only run in Service Worker context
// ========================================================= //
if (typeof self === 'undefined' || !('caches' in self)) {
  console.log('[SW] ⚠️ Service Worker: Not in service worker context, skipping initialization');
  // Prevent further execution gracefully
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  }
  // Exit early - prevent all code below from running
  if (typeof module !== 'undefined') {
    try { module.exports = {}; } catch (e) {}
  }
  // Will not reach code below in non-SW context
} else {
  
// ========================================================= //
// SERVICE WORKER INITIALIZATION (Browser context only)
// ========================================================= //

// 🚀 OTIMIZAÇÃO SPRINT 3 (4/4): Estratégia de cache melhorada
const CACHE_VERSION = 'fa-rrt-v3.0.0-optimized';
const CACHE_ASSETS = `${CACHE_VERSION}-assets`;        // Recursos estáticos (CSS, fonts)
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;      // Dados dinâmicos (API responses)
const CACHE_IMAGES = `${CACHE_VERSION}-images`;        // Imagens (fotos)
const MAX_CACHE_ITEMS = 100;                            // Limite de itens em cache
const DB_NAME = 'fa-rrt-db';
const STORE_QUEUE = 'sync-queue';
const STORE_REVIEWS = 'offline-reviews';

// ✅ Arquivos essenciais para offline (sem Chart.js que agora é lazy-loaded)
const ESSENTIAL_ASSETS = [
  'index.html',
  'ui/reviewer.html',
  'ui/estoque.html',
  'ui/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
  // ⚡ OTIMIZAÇÃO: Font Awesome não carregado no install (lazy ou on-demand)
];

// ==================== CACHE HELPERS ====================
/**
 * 🚀 OTIMIZAÇÃO: Cleanup automático LRU (Least Recently Used)
 * Mantém cache <= 100 items, remove itens antigos
 */
async function cleanupCache(cacheName, maxItems = MAX_CACHE_ITEMS) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    for (const key of keysToDelete) {
      await cache.delete(key);
    }
    console.log(`[SW] 🗑️  Limpeza LRU: removidas ${keysToDelete.length} URLs antigas de ${cacheName}`);
  }
}

/**
 * 🔄 Cache-First Strategy: Serve from cache if available, else network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_ASSETS);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const clonedResponse = response.clone();
      cache.put(request, clonedResponse);
      cleanupCache(CACHE_ASSETS); // LRU cleanup
    }
    return response;
  } catch (err) {
    console.warn('[SW] ⚠️  Falha em cacheFirst para:', request.url);
    throw err;
  }
}

/**
 * 🌐 Network-First Strategy: Try network first, fallback to cache
 */
async function networkFirst(request) {
  const dynamicCache = await caches.open(CACHE_DYNAMIC);
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const clonedResponse = response.clone();
      dynamicCache.put(request, clonedResponse);
      cleanupCache(CACHE_DYNAMIC); // LRU cleanup
    }
    return response;
  } catch (err) {
    const cached = await dynamicCache.match(request);
    if (cached) {
      console.log('[SW] 📦 Using cached response (network failed):', request.url);
      return cached;
    }
    throw err;
  }
}

// ==================== EVENT: INSTALL ====================
self.addEventListener('install', event => {
  console.log('[SW] Instalando service worker...');
  
  event.waitUntil(
    caches.open(CACHE_ASSETS).then(cache => {
      console.log('[SW] Cache de assets criado');
      // Não fazer cache forçado - deixar o navegador decidir
      return Promise.resolve();
    }).then(() => self.skipWaiting())
  );
});

// ==================== EVENT: ACTIVATE ====================
self.addEventListener('activate', event => {
  console.log('[SW] Ativando service worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_ASSETS && name !== CACHE_DYNAMIC && !name.startsWith(CACHE_VERSION))
          .map(name => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ==================== EVENT: FETCH ====================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // Requisições para Google Apps Script - Network First
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Requisições para Google Drive (fotos) - Network First com fallback
  if (url.hostname.includes('drive.google.com') || url.hostname.includes('lh3.googleusercontent.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Requisições locais - Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Fontes e recursos externos - Cache First
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Padrão: Network First com fallback para cache
  event.respondWith(networkFirst(request));
});


// ==================== RESPONSE OFFLINE ====================
function createOfflineResponse() {
  return new Response(
    JSON.stringify({ offline: true, message: 'Você está offline' }),
    { 
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'application/json' })
    }
  );
}

// ==================== MESSAGE: SYNC QUEUE ====================
self.addEventListener('message', event => {
  const { type, data } = event.data;

  console.log('[SW] Mensagem recebida:', type);

  if (type === 'SYNC_QUEUE') {
    syncOfflineQueue();
  } else if (type === 'CLEAR_CACHE') {
    clearAllCaches();
  } else if (type === 'QUEUE_DATA') {
    queueOfflineData(data);
  }
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reviews') {
    console.log('[SW] Background sync: sincronizando revisões offline');
    event.waitUntil(syncOfflineQueue());
  }
});

// ==================== FUNÇÕES DE SINCRONIZAÇÃO ====================

/**
 * Sincronizar fila de dados offline
 */
async function syncOfflineQueue() {
  try {
    const db = await openDB();
    const queue = await getAllFromStore(db, STORE_QUEUE);

    console.log(`[SW] Sincronizando ${queue.length} itens da fila`);

    for (const item of queue) {
      try {
        const response = await fetch(item.endpoint, {
          method: item.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });

        if (response.ok) {
          // Remover da fila
          await removeFromStore(db, STORE_QUEUE, item.id);
          console.log(`[SW] ✅ Item sincronizado: ${item.id}`);
          
          // Notificar cliente
          notifyClients({
            type: 'SYNC_SUCCESS',
            message: `Dados sincronizados: ${item.id}`
          });
        } else {
          console.warn(`[SW] Erro ao sincronizar ${item.id}:`, response.status);
        }
      } catch (error) {
        console.error(`[SW] Erro ao sincronizar ${item.id}:`, error);
      }
    }

    console.log('[SW] ✅ Sincronização concluída');
  } catch (error) {
    console.error('[SW] Erro na sincronização:', error);
  }
}

/**
 * Armazenar dados para sincronização offline
 */
async function queueOfflineData(data) {
  try {
    const db = await openDB();
    const id = `${Date.now()}-${Math.random()}`;
    
    const item = {
      id,
      endpoint: data.endpoint,
      method: data.method || 'POST',
      data: data.data,
      timestamp: Date.now(),
      status: 'pending'
    };

    await addToStore(db, STORE_QUEUE, item);
    console.log(`[SW] ✅ Dados armazenados para sincronização: ${id}`);

    // Tentar sincronizar se online
    if (navigator.onLine) {
      syncOfflineQueue();
    }
  } catch (error) {
    console.error('[SW] Erro ao fila de dados:', error);
  }
}

// ==================== IndexedDB HELPERS ====================

/**
 * Abrir banco de dados IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Criar object stores
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        console.log('[SW] Object store criado:', STORE_QUEUE);
      }

      if (!db.objectStoreNames.contains(STORE_REVIEWS)) {
        db.createObjectStore(STORE_REVIEWS, { keyPath: 'review_id' });
        console.log('[SW] Object store criado:', STORE_REVIEWS);
      }
    };
  });
}

/**
 * Adicionar item ao IndexedDB
 */
function addToStore(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Obter todos os items do IndexedDB
 */
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Remover item do IndexedDB
 */
function removeFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ==================== CACHE MANAGEMENT ====================

/**
 * Limpar todos os caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(name => caches.delete(name))
  );
  console.log('[SW] ✅ Todos os caches foram limpados');
  notifyClients({ type: 'CACHE_CLEARED' });
}

// ==================== NOTIFICAÇÕES PARA CLIENTES ====================

/**
 * Notificar todos os clientes abertos
 */
function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

// ==================== LOGGING ====================
console.log('[SW] Service Worker carregado com sucesso');

} // End of Service Worker context check
