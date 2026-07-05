/**
 * Barcode Scanner Module
 * - On Android/native: uses @capacitor-mlkit/barcode-scanning (avoids WebView camera lifecycle crashes)
 * - On Web: uses Html5Qrcode (loaded via CDN in index.html)
 * - Supports: Hardware barcode gun detection (all platforms)
 */

export const scanner = {
  html5Qrcode: null,
  isScanning: false,
  _closing: false,

  _isNative() {
    return window.Capacitor && window.Capacitor.isNativePlatform();
  },

  async open(callback) {
    if (this._isNative()) {
      await this._openNative(callback);
    } else {
      await this._openWeb(callback);
    }
  },

  // ──────────────────────────────────────────
  // NATIVE SCANNER (Android via MLKit plugin)
  // ──────────────────────────────────────────
  async _openNative(callback) {
    const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;

    if (!BarcodeScanner) {
      app.showToast('Plugin de escáner no disponible, usando cámara web...', 'info');
      await this._openWeb(callback);
      return;
    }

    // Check and request camera permission
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const result = await BarcodeScanner.requestPermissions();
        if (result.camera !== 'granted') {
          app.showToast('Se necesita permiso de cámara para escanear.', 'error');
          return;
        }
      }
    } catch(e) {
      console.warn('Permission check failed:', e);
    }

    // Check if Google Barcode Scanner module is installed
    // installGoogleBarcodeScannerModule() returns immediately but installs asynchronously
    // We must wait for the progress event to signal completion
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        app.showToast('Instalando módulo de escáner de Google... Por favor espera.', 'info');
        
        // Wait for the module installation to fully complete
        await new Promise((resolve, reject) => {
          let listenerHandle = null;
          
          const timeout = setTimeout(() => {
            if (listenerHandle) listenerHandle.remove();
            reject(new Error('Timeout esperando instalación del módulo'));
          }, 60000); // 60 second timeout

          BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (event) => {
            console.log('Install progress:', JSON.stringify(event));
            // state 3 = installed/complete, state 2 = downloaded
            if (event.state === 3 || event.progress === 100) {
              clearTimeout(timeout);
              if (listenerHandle) listenerHandle.remove();
              resolve();
            }
            if (event.state === 5 || event.state === 6) { // failed states
              clearTimeout(timeout);
              if (listenerHandle) listenerHandle.remove();
              reject(new Error('Error al instalar el módulo'));
            }
          }).then(handle => { listenerHandle = handle; });

          // Trigger the installation after setting up the listener
          BarcodeScanner.installGoogleBarcodeScannerModule().catch(reject);
        });

        app.showToast('Módulo instalado. Abriendo escáner...', 'success');
      }
    } catch(e) {
      console.error('Module install failed:', e);
      app.showToast('No se pudo instalar el módulo de escáner: ' + e.message, 'error');
      return;
    }

    try {
      app.showToast('Apunta la cámara al código...', 'info');
      const { barcodes } = await BarcodeScanner.scan({
        formats: ['Code128', 'Code39', 'Ean13', 'Ean8', 'QrCode', 'UpcA', 'UpcE'],
      });

      if (barcodes && barcodes.length > 0) {
        const decodedText = barcodes[0].rawValue;
        app.showToast(`Código: ${decodedText}`, 'success');
        if (typeof callback === 'function') {
          callback(decodedText);
        }
      }
    } catch (err) {
      // User cancelled the scan — no error needed
      if (!err.message?.toLowerCase().includes('cancel') && !err.message?.toLowerCase().includes('user')) {
        console.error('Native scanner error:', err);
        app.showToast('Error al escanear. Intenta de nuevo.', 'error');
      }
    }
  },

  // ──────────────────────────────────────────
  // WEB SCANNER (browser via Html5Qrcode CDN)
  // ──────────────────────────────────────────
  async _openWeb(callback) {
    app.openModal('modal-scanner');
    await new Promise(r => setTimeout(r, 300));

    // Fully destroy any previous instance first
    await this._webCleanup();
    await new Promise(r => setTimeout(r, 400));

    // Rebuild the reader div so Html5Qrcode always gets a fresh element
    const container = document.querySelector('#modal-scanner .modal-body');
    const oldReader = document.getElementById('reader');
    if (oldReader) oldReader.remove();
    const newReader = document.createElement('div');
    newReader.id = 'reader';
    newReader.style.width = '100%';
    if (container) container.appendChild(newReader);

    try {
      this.html5Qrcode = new Html5Qrcode('reader');
      this.isScanning = true;

      await this.html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
        (decodedText) => {
          if (this._closing) return;
          this._closing = true;
          setTimeout(async () => {
            await this._webCleanup();
            app.closeModal('modal-scanner');
            app.showToast(`Código: ${decodedText}`, 'success');
            if (typeof callback === 'function') callback(decodedText);
            this._closing = false;
          }, 200);
        },
        () => {} // ignore frame errors
      );
    } catch (err) {
      console.error('Camera error:', err);
      this.isScanning = false;
      this.html5Qrcode = null;
      app.showToast('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
      app.closeModal('modal-scanner');
    }
  },

  async _webCleanup() {
    if (this.html5Qrcode) {
      try { if (this.isScanning) await this.html5Qrcode.stop(); } catch(e) {}
      try { this.html5Qrcode.clear(); } catch(e) {}
      this.html5Qrcode = null;
    }
    this.isScanning = false;
  },

  async close() {
    if (this._isNative()) {
      // Native scanner closes itself after scan() resolves or is cancelled
    } else {
      await this._webCleanup();
      app.closeModal('modal-scanner');
    }
  },

  /**
   * Hardware barcode gun detection
   * Barcode guns type very fast (< 50ms between keystrokes) and end with Enter key
   */
  initGunDetection(inputElement, callback) {
    let barcode = '';
    let timer = null;

    inputElement.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcode.length > 3) {
          callback(barcode);
        }
        barcode = '';
        clearTimeout(timer);
        return;
      }

      if (e.key.length === 1) { // printable character
        barcode += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { barcode = ''; }, 150);
      }
    });
  }
};
