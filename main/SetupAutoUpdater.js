import { app, BrowserWindow, ipcMain } from 'electron';
import updater from 'electron-updater';
const { autoUpdater } = updater;

const GITHUB_OWNER = 'Etienne780';
const GITHUB_REPO = 'DocForge';

function send(event, data = {}) {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  win?.webContents.send(event, data);
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function extractMetaBlock(notes) {
  if (!notes || typeof notes !== 'string')
    return null;
  const m = notes.match(/<!--\s*update-meta:\s*(.*?)\s*-->/is);
  return m ? m[1] : null;
}

function parseMetaFields(block) {
  if (!block) 
    return {};

  const result = {};
  const len = block.length;
  let i = 0;

  const isKeyStart = (ch) => /[A-Za-z_]/.test(ch);
  const isKeyChar = (ch) => /\w/.test(ch);

  while (i < len) {
    while (i < len && /[\s;]/.test(block[i]))
      i++;
    if (i >= len)
      break;

    if (!isKeyStart(block[i])) {
      i++;
      continue;
    }

    const keyStart = i;
    while (i < len && isKeyChar(block[i]))
      i++;
    const key = block.slice(keyStart, i);

    while (i < len && /\s/.test(block[i]))
      i++;

    if (block[i] !== '=')
      continue;

    i++;
    while (i < len && /\s/.test(block[i]))
      i++;

    let value = '';
    if (block[i] === '"' || block[i] === "'") {
      const quote = block[i];
      i++;
      while (i < len && block[i] !== quote) {
        if (block[i] === '\\' && i + 1 < len) {
          value += block[i + 1];
          i += 2;
        } else {
          value += block[i];
          i++;
        }
      }
      i++;
      while (i < len && /[\s;]/.test(block[i])) 
        i++;
    } else {
      const valStart = i;
      while (i < len && block[i] !== ';')
        i++;
      value = block.slice(valStart, i).trim();
      if (block[i] === ';')
        i++;
    }

    result[key] = value;
  }

  return result;
}

function parseUpdateMeta(notes) {
  const block = extractMetaBlock(notes);
  const fields = parseMetaFields(block);

  return {
    minCompatibleVersion: fields.minCompatibleVersion ?? null,
    incompatibilityNote: fields.incompatibilityNote ?? null,
  };
}

function stripUpdateMeta(notes) {
  if (!notes)
    return notes;
  return notes.replace(/<!--\s*update-meta:.*?-->/gis, '').trim();
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na !== nb)
      return na - nb;
  }
  return 0;
}

function resolveReleaseNotes(info) {
  if (typeof info.releaseNotes === 'string')
    return info.releaseNotes;

  if (Array.isArray(info.releaseNotes)) {
    const match = info.releaseNotes.find(n => n.version === info.version);
    return match?.note ?? info.releaseNotes[0]?.note ?? null;
  }

  return null;
}

// The release notes electron-updater provides come from GitHub's rendered
// releases.atom feed, which strips HTML comments (and with them the
// update-meta block). The raw markdown body from the API still contains it.
async function fetchRawReleaseBody(version) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${version}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return typeof json.body === 'string' ? json.body : null;
  } catch (err) {
    console.error('[Electron][AutoUpdater] Failed to fetch raw release notes:', err.message);
    return null;
  }
}

async function buildAvailablePayload(info) {
  const currentVersion = app.getVersion();
  const rawNotes = resolveReleaseNotes(info);
  const rawBody = await fetchRawReleaseBody(info.version);
  const { minCompatibleVersion, incompatibilityNote } = parseUpdateMeta(rawBody ?? rawNotes);
  const isCompatible = !minCompatibleVersion || compareVersions(currentVersion, minCompatibleVersion) >= 0;

  return {
    version: info.version,
    releaseNotes: stripUpdateMeta(rawNotes),
    minCompatibleVersion,
    incompatibilityNote: isCompatible ? null : incompatibilityNote,
    currentVersion,
    isCompatible,
  };
}

export function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => send('updater:checking'));

  autoUpdater.on('update-available', async (info) => {
    send('updater:available', await buildAvailablePayload(info));
  });

  autoUpdater.on('update-not-available', (info) => send('updater:notAvailable', info));
  autoUpdater.on('download-progress', (prog) => send('updater:progress', prog));
  autoUpdater.on('update-downloaded', (info) => send('updater:downloaded', info));
  autoUpdater.on('error', (err) => send('updater:error', { message: err.message }));

  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates());
  // Failures are reported through the 'error' event, don't reject the invoke as well
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate().catch(() => {}));
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());
}