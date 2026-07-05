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

    // Wait a tick for the modal to be visible (DOM needs to render)
    await new Promise(r => setTimeout(r, 300));

    // Ensure we start with a clean DOM element
    const reader = document.getElementById('reader');
    if (reader) reader.innerHTML = '';
    
    // Clean up any lingering instance
    if (this.html5Qrcode) {
      try {
        await this.html5Qrcode.stop();
      } catch (e) {}
      try {
        this.html5Qrcode.clear();
      } catch (e) {}
      this.html5Qrcode = null;
    }

    try {
      this.html5Qrcode = new Html5Qrcode("reader");
      this.isScanning = true;

      await this.html5Qrcode.start(
        { facingMode: "environment" }, // Use rear camera
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // SUCCESS — code detected
          // Stop scanning asynchronously to avoid library internal race conditions
          setTimeout(() => {
            this.close();
            app.showToast(`Código: ${decodedText}`, 'success');
            if (typeof callback === 'function') {
              callback(decodedText);
            }
          }, 50);
        },
        (errorMessage) => {
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

  async close() {
    if (this.html5Qrcode) {
      try {
        await this.html5Qrcode.stop();
      } catch(e) {
        console.warn('Scanner stop error:', e);
      }
      try {
        this.html5Qrcode.clear();
      } catch(e) {
        console.warn('Scanner clear error:', e);
      }
    }
    this.isScanning = false;
    this.html5Qrcode = null;
    
    // Explicitly clean the DOM container
    const reader = document.getElementById('reader');
    if (reader) reader.innerHTML = '';

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
