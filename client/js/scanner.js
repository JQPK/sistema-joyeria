/**
 * Barcode Scanner Module
 * Uses Html5Qrcode (loaded via CDN in index.html)
 * Supports: Camera scanner + Hardware barcode gun
 */

export const scanner = {
  html5Qrcode: null,
  isScanning: false,
  
  async open(callback) {
    // Open the scanner modal
    app.openModal('modal-scanner');

    // Wait for modal to be visible
    await new Promise(r => setTimeout(r, 300));

    // Ensure any previous session is fully stopped before starting new one
    await this._cleanup();

    // Wait for the camera hardware to fully release (prevents AbortError)
    await new Promise(r => setTimeout(r, 500));

    try {
      this.html5Qrcode = new Html5Qrcode("reader");
      this.isScanning = true;

      await this.html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // SUCCESS — let the scan frame finish processing before closing
          if (this._closing) return; // prevent double fire
          this._closing = true;
          setTimeout(async () => {
            await this._cleanup();
            app.closeModal('modal-scanner');
            app.showToast(`Código: ${decodedText}`, 'success');
            if (typeof callback === 'function') {
              callback(decodedText);
            }
            this._closing = false;
          }, 200);
        },
        () => {
          // Ignore continuous scan errors
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      this.isScanning = false;
      this.html5Qrcode = null;
      app.showToast('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
      app.closeModal('modal-scanner');
    }
  },

  async _cleanup() {
    if (this.html5Qrcode) {
      try {
        if (this.isScanning) {
          await this.html5Qrcode.stop();
        }
      } catch(e) {}
      try {
        // clear() removes the Html5Qrcode created elements cleanly
        this.html5Qrcode.clear();
      } catch(e) {}
      this.html5Qrcode = null;
    }
    this.isScanning = false;
  },

  async close() {
    await this._cleanup();
    app.closeModal('modal-scanner');
  },

  /**
   * Hardware barcode gun detection
   * Barcode guns type very fast (< 50ms between keystrokes)
   * and end with Enter key
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
        timer = setTimeout(() => {
          barcode = '';
        }, 150);
      }
    });
  }
};
