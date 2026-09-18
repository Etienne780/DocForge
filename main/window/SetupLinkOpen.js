import { shell } from 'electron';

export function setupLinkOpen(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }

    return {
      action: 'deny'
    };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function isExternalUrl(url) {
  return (
    url.startsWith('https://') ||
    (url.startsWith('http://') && !url.startsWith('http://localhost:5173'))
  );
}