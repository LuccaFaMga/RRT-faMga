/**
 * ============================================================================
 * OFFLINE MANAGER - GERENCIAMENTO DE FUNCIONALIDADE OFFLINE
 * ============================================================================
 * Responsável por:
 * - Registrar e gerenciar Service Worker
 * - Detectar status de conectividade
 * - Armazenar dados offline
 * - Sincronizar fila quando reconectar
 * ============================================================================
 */

class OfflineManager {
  constructor() {
    // Only initialize in browser context
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      console.warn('[OFFLINE] ⚠️ OfflineManager: Not in browser context, skipping initialization');
      return;
    }

    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.listeners = [];

    this.init();
  }

  /**
   * Inicializar offline manager
   */
  async init() {
    // Skip if not in browser
    if (typeof window === 'undefined') return;

    console.log('[OFFLINE] Inicializando OfflineManager...');

    // Registrar service worker (skip on Apps Script host)
    const isAppsScriptHost = location.hostname.includes('script.googleusercontent.com') || location.hostname.includes('script.google.com');
    if (!isAppsScriptHost && 'serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        console.log('[OFFLINE] ✅ Service Worker registrado');
      } catch (error) {
        console.warn('[OFFLINE] ⚠️ Erro ao registrar Service Worker:', error);
      }
    } else if (isAppsScriptHost) {
      console.warn('[OFFLINE] ⚠️ Service Worker desabilitado no host Apps Script');
    }

    // Abrir IndexedDB
    await this.openIndexedDB();

    // Listeners de conectividade
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listener para mensagens do SW
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleSWMessage(event.data);
      });
    }

    console.log('[OFFLINE] ✅ OfflineManager inicializado');
  }

  /**
   * Abrir banco de dados IndexedDB
   */
  openIndexedDB() {
    // Skip if not in browser
    if (typeof indexedDB === 'undefined') {
      console.warn('[OFFLINE] ⚠️ IndexedDB not available');
      return Promise.reject(new Error('IndexedDB not available'));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('fa-rrt-db', 1);

      request.onerror = () => {
        console.error('[OFFLINE] Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OFFLINE] ✅ IndexedDB aberto');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Criar object stores
        if (!db.objectStoreNames.contains('sync-queue')) {
          db.createObjectStore('sync-queue', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('offline-reviews')) {
          db.createObjectStore('offline-reviews', { keyPath: 'review_id' });
        }

        if (!db.objectStoreNames.contains('offline-uploads')) {
          db.createObjectStore('offline-uploads', { keyPath: 'upload_id' });
        }
      };
    });
  }

  /**
   * Quando conectar à internet
   */
  async handleOnline() {
    console.log('[OFFLINE] 🟢 Conectado à internet!');
    this.isOnline = true;
    this.updateUI();

    // Sincronizar fila de dados pendentes
    setTimeout(() => this.syncQueue(), 1000);

    this.notifyListeners('online');
  }

  /**
   * Quando desconectar da internet
   */
  handleOffline() {
    console.log('[OFFLINE] 🔴 Desconectado da internet!');
    this.isOnline = false;
    this.updateUI();

    this.notifyListeners('offline');
  }

  /**
   * Sincronizar fila de dados offline
   */
  async syncQueue() {
    if (this.syncInProgress) {
      console.log('[OFFLINE] Sincronização já em progress...');
      return;
    }

    this.syncInProgress = true;
    console.log('[OFFLINE] 🔄 Iniciando sincronização de fila...');

    try {
      const queue = await this.getAllFromStore('sync-queue');
      console.log(`[OFFLINE] Encontrados ${queue.length} itens para sincronizar`);

      for (const item of queue) {
        try {
          const success = await this.syncItem(item);

          if (success) {
            await this.removeFromStore('sync-queue', item.id);
            console.log(`[OFFLINE] ✅ Sincronizado: ${item.id}`);
          }
        } catch (error) {
          console.error(`[OFFLINE] ❌ Erro ao sincronizar ${item.id}:`, error);
        }
      }

      console.log('[OFFLINE] ✅ Sincronização concluída');
      this.notifyListeners('sync-complete');
    } catch (error) {
      console.error('[OFFLINE] Erro na sincronização:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sincronizar um item individual
   */
  async syncItem(item) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });

      if (response.ok) {
        console.log(`[OFFLINE] Item sincronizado com sucesso: ${item.id}`);
        return true;
      } else {
        console.warn(`[OFFLINE] Erro ao sincronizar (HTTP ${response.status}): ${item.id}`);
        return false;
      }
    } catch (error) {
      console.error(`[OFFLINE] Erro de rede ao sincronizar ${item.id}:`, error);
      return false;
    }
  }

  /**
   * Armazenar dados para sincronização offline
   */
  async queueData(endpoint, data, method = 'POST') {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const item = {
        id,
        endpoint,
        method,
        data,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0
      };

      await this.addToStore('sync-queue', item);
      console.log(`[OFFLINE] ✅ Dados enfileirados: ${id}`);

      // Se online, sincronizar imediatamente
      if (this.isOnline) {
        this.syncQueue();
      }

      return id;
    } catch (error) {
      console.error('[OFFLINE] Erro ao enfileirar dados:', error);
      throw error;
    }
  }

  /**
   * Armazenar revisão offline
   */
  async storeOfflineReview(reviewData) {
    try {
      const review = {
        review_id: reviewData.review_id || `offline-${Date.now()}`,
        ...reviewData,
        storedAt: Date.now(),
        synced: false
      };

      await this.addToStore('offline-reviews', review);
      console.log('[OFFLINE] ✅ Revisão armazenada offline:', review.review_id);

      return review.review_id;
    } catch (error) {
      console.error('[OFFLINE] Erro ao armazenar revisão:', error);
      throw error;
    }
  }

  /**
   * Obter revisões offline não sincronizadas
   */
  async getUnsyncedReviews() {
    try {
      const reviews = await this.getAllFromStore('offline-reviews');
      return reviews.filter(r => !r.synced);
    } catch (error) {
      console.error('[OFFLINE] Erro ao obter revisões não sincronizadas:', error);
      return [];
    }
  }

  /**
   * Marcar revisão como sincronizada
   */
  async markReviewAsSynced(reviewId) {
    try {
      const review = await this.getFromStore('offline-reviews', reviewId);
      if (review) {
        review.synced = true;
        review.syncedAt = Date.now();
        await this.updateInStore('offline-reviews', review);
        console.log('[OFFLINE] ✅ Revisão marcada como sincronizada:', reviewId);
      }
    } catch (error) {
      console.error('[OFFLINE] Erro ao marcar revisão como sincronizada:', error);
    }
  }

  /**
   * IndexedDB Helpers
   */

  async addToStore(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async updateInStore(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removeFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * UI Updates
   */

  updateUI() {
    // Skip if not in browser
    if (typeof document === 'undefined') return;

    const statusEl = document.getElementById('offline-status');
    if (!statusEl) return;

    if (this.isOnline) {
      statusEl.innerHTML = '✅ Online - Sincronizando...';
      statusEl.style.backgroundColor = '#10b981';
      statusEl.style.color = 'white';
    } else {
      statusEl.innerHTML = '🔴 Offline - Modo local ativado';
      statusEl.style.backgroundColor = '#ef4444';
      statusEl.style.color = 'white';
    }
  }

  /**
   * Event Listeners
   */

  onStatusChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event, this.isOnline);
      } catch (error) {
        console.error('[OFFLINE] Erro em listener:', error);
      }
    });
  }

  /**
   * Handle messages from Service Worker
   */
  handleSWMessage(message) {
    console.log('[OFFLINE] Mensagem do SW:', message);

    if (message.type === 'SYNC_SUCCESS') {
      console.log('[OFFLINE] ✅', message.message);
      this.notifyListeners('item-synced');
    } else if (message.type === 'CACHE_CLEARED') {
      console.log('[OFFLINE] Cache limpo');
    }
  }

  /**
   * Utils
   */

  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      timestamp: new Date().toISOString()
    };
  }

  async getQueueLength() {
    const queue = await this.getAllFromStore('sync-queue');
    return queue.length;
  }
}

// Instância global - apenas em contexto browser
if (typeof window !== 'undefined') {
  window.OfflineManager = new OfflineManager();
  console.log('[OFFLINE] OfflineManager disponível globalmente');
} else {
  console.log('[OFFLINE] ⚠️ OfflineManager: Ambiente não-browser detectado, inicialização pulada');
}
