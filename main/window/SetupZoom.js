export function setupZoom(window) {
  window.webContents.on('before-input-event', (event, input) => {
    if (!input.control) 
      return;
    
    const minZoom = 0.7;
    const maxZoom = 1.4;
    const currentZoom = window.webContents.getZoomFactor();
    let newZoom = null;
    
    if (input.key === '-') {
      newZoom = Math.max(currentZoom - 0.1, minZoom);
      event.preventDefault();
    }
    
    if (input.key === '=' || input.key === '+') {
      newZoom = Math.min(currentZoom + 0.1, maxZoom);
      event.preventDefault();
    }
    
    if (input.key === '0') {
      newZoom = 1.0;
      event.preventDefault();
    }
    
    if (newZoom !== null) {
      window.webContents.setZoomFactor(newZoom);
      window.webContents.send('zoom:changed', newZoom);
    }
  });
}