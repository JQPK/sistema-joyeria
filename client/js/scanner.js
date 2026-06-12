export const scanner = {
  html5QrcodeScanner: null,
  
  async open(callback) {
    app.openModal('modal-scanner');
    
    // Clear previous instance if exists
    if (this.html5QrcodeScanner) {
      try {
        await this.html5QrcodeScanner.clear();
      } catch(e) {}
    }

    this.html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: {width: 250, height: 150} },
      false
    );

    this.html5QrcodeScanner.render((decodedText, decodedResult) => {
      // On success
      app.closeModal('modal-scanner');
      this.html5QrcodeScanner.clear();
      app.showToast(`Código detectado: ${decodedText}`, 'success');
      
      if (typeof callback === 'function') {
        callback(decodedText);
      }
    }, (error) => {
      // ignore continuous errors
    });
  },

  close() {
    if (this.html5QrcodeScanner) {
      try {
        this.html5QrcodeScanner.clear();
      } catch(e) {}
    }
    app.closeModal('modal-scanner');
  },

  // Detection for hardware barcode gun (rapid keystrokes)
  initGunDetection(inputElement, callback) {
    let barcode = '';
    let reading = false;
    let timer = null;

    inputElement.addEventListener('keypress', e => {
      // Usually barcode scanners end with Enter (key code 13)
      if (e.key === 'Enter') {
        if (barcode.length > 3) {
          callback(barcode);
        }
        barcode = '';
        reading = false;
        clearTimeout(timer);
        return;
      }

      if (e.key !== 'Shift') {
        barcode += e.key;
        reading = true;
        
        clearTimeout(timer);
        timer = setTimeout(() => {
          reading = false;
          barcode = '';
        }, 200); // If more than 200ms between keystrokes, it's manual typing
      }
    });
  }
};

// Bind to app for global access
window.scanner = scanner;
