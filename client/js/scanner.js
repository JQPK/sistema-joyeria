/**
 * Barcode Scanner Module
 * - On Android/native: uses @capacitor-mlkit/barcode-scanning with startScan/stopScan
 *   (does NOT require Google Barcode Scanner Module to be installed separately)
 * - On Web: uses Html5Qrcode with pause/resume to avoid ThreadPool termination
 * - Supports: Hardware barcode gun detection (all platforms)
 */

export const scanner = {
  html5Qrcode: null,
  isScanning: false,
  _nativeListener: null,

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
  // NATIVE SCANNER — uses startScan (bundled ML Kit, no external module needed)
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

    // Stop any previous scan session
    try { await BarcodeScanner.stopScan(); } catch(e) {}

    // Remove previous listener if any
    if (this._nativeListener) {
      try { this._nativeListener.remove(); } catch(e) {}
      this._nativeListener = null;
    }

    try {
      // Listen for barcodes — fires each time a code is detected
      this._nativeListener = BarcodeScanner.addListener('barcodesScanned', async (result) => {
        if (result.barcodes && result.barcodes.length > 0) {
          const decodedText = result.barcodes[0].rawValue;

          // Stop scanning immediately
          try { await BarcodeScanner.stopScan(); } catch(e) {}
          if (this._nativeListener) {
            try { this._nativeListener.remove(); } catch(e) {}
            this._nativeListener = null;
          }

          app.showToast(`Código: ${decodedText}`, 'success');
          if (typeof callback === 'function') {
            callback(decodedText);
          }
        }
      });

      // Start the camera overlay scanner
      await BarcodeScanner.startScan({
        formats: ['Code128', 'Code39', 'Ean13', 'Ean8', 'QrCode', 'UpcA', 'UpcE'],
        lensFacing: 'back',
      });

      app.showToast('Apunta la cámara al código. Toca aquí para cancelar.', 'info');

    } catch (err) {
      console.error('Native scanner startScan error:', err);
      try { await BarcodeScanner.stopScan(); } catch(e) {}
      if (this._nativeListener) {
        try { this._nativeListener.remove(); } catch(e) {}
        this._nativeListener = null;
      }
      app.showToast('Error al iniciar el escáner nativo.', 'error');
    }
  },

  async _stopNative() {
    const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;
    if (BarcodeScanner) {
      try { await BarcodeScanner.stopScan(); } catch(e) {}
    }
    if (this._nativeListener) {
      try { this._nativeListener.remove(); } catch(e) {}
      this._nativeListener = null;
    }
  },

  // ──────────────────────────────────────────
  // WEB SCANNER — Html5Qrcode with pause/resume to avoid ThreadPool crash
  // ──────────────────────────────────────────
  async _openWeb(callback) {
    app.openModal('modal-scanner');
    await new Promise(r => setTimeout(r, 300));

    // If already running, just resume
    if (this.html5Qrcode && this.isScanning) {
      try {
        this.html5Qrcode.resume();
      } catch(e) {}
      return;
    }

    // Rebuild the reader div for a fresh start
    const container = document.querySelector('#modal-scanner .modal-body');
    const oldReader = document.getElementById('reader');
    if (oldReader) oldReader.remove();
    const newReader = document.createElement('div');
    newReader.id = 'reader';
    newReader.style.width = '100%';
    if (container) container.appendChild(newReader);

    if (this.html5Qrcode) {
      try { this.html5Qrcode.clear(); } catch(e) {}
      this.html5Qrcode = null;
    }

    try {
      this.html5Qrcode = new Html5Qrcode('reader');
      this.isScanning = true;

      await this.html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
        (decodedText) => {
          // PAUSE instead of stop — keeps camera thread alive for next scan
          try { this.html5Qrcode.pause(true); } catch(e) {}
          this.isScanning = false;
          app.closeModal('modal-scanner');
          app.showToast(`Código: ${decodedText}`, 'success');
          if (typeof callback === 'function') callback(decodedText);
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

  async close() {
    if (this._isNative()) {
      await this._stopNative();
    } else {
      // Pause camera instead of stopping to preserve the hardware thread
      if (this.html5Qrcode) {
        try { this.html5Qrcode.pause(true); } catch(e) {}
      }
      this.isScanning = false;
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
