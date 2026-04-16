import { normalizeFileName } from '@common/Common.js';

/**
 * Manages object URLs created from Blob data, ensuring proper memory cleanup.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 * Blobs are stored under an optional section namespace and a key:
 *   blobManager.add('images', 'avatar', { data: buffer, type: 'image/png' });
 *   blobManager.getURL('images', 'avatar'); // → "blob:..."
 *   blobManager.remove('images', 'avatar');
 *   blobManager.download('images', 'avatar', 'my-avatar', '.png');
 *
 * ─── Key Format ───────────────────────────────────────────────────────────────
 * With section:    "images:avatar"
 * Without section: "avatar"
 *
 * ─── Memory Management ────────────────────────────────────────────────────────
 * Every stored URL is revoked automatically on:
 *   - add() when replacing an existing entry for the same key
 *   - remove() / removeAll() / removeSection() when entries are explicitly cleared
 *   - window beforeunload to prevent leaks on page exit
 *
 * Call init() once after instantiation to register the beforeunload listener.
 */
export class BlobManager {

  constructor() {
    /** @type {Map<string, { url: string, data: BlobPart }>} Internal store keyed by "section:key" */
    this._blobs = new Map();
  }

  /**
   * Registers the beforeunload listener that revokes all URLs on page exit.
   * Should be called once after instantiation.
   */
  init() {
    window.addEventListener('beforeunload', () => {
      this.removeAll();
    });
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

  /**
   * Creates a Blob from the given data, generates an object URL, and stores both.
   * If an entry already exists for the same key, its URL is revoked before being replaced.
   * @param {string|null} section - Optional namespace, e.g. "images"
   * @param {string} key - Identifier within the section
   * @param {{ data: BlobPart, type: string }} options - Raw data and MIME type ('text/css')
   * @returns {{ url: string, data: BlobPart }|null} The created entry, or null if parameters were invalid
   */
  add(section = null, key, { data, type }) {
    if (!key || !data || !type) {
      console.error('[BlobManager] add: invalid parameters');
      return null;
    }

    const k = this._buildKey(section, key);

    const existing = this._blobs.get(k);
    if (existing) {
      URL.revokeObjectURL(existing.url);
    }

    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);

    const entry = this._createEntry(url, data);
    this._blobs.set(k, entry);
    return entry;
  }

  /**
   * Revokes the object URL for the given entry and removes it from the store.
   * Does nothing if the key does not exist.
   * @param {string|null} section
   * @param {string} key
   */
  remove(section = null, key) {
    const k = this._buildKey(section, key);

    const entry = this._blobs.get(k);
    if (!entry)
      return;

    URL.revokeObjectURL(entry.url);
    this._blobs.delete(k);
  }

  /**
   * Revokes all object URLs within a given section and removes those entries from the store.
   * Useful for cleaning up a logical group without clearing the entire store.
   * @param {string} section
   */
  removeSection(section) {
    const prefix = `${section}:`;
    for (const [k, entry] of this._blobs.entries()) {
      if (k.startsWith(prefix)) {
        URL.revokeObjectURL(entry.url);
        this._blobs.delete(k);
      }
    }
  }

  /**
   * Revokes all stored object URLs and clears the internal store.
   */
  removeAll() {
    for (const entry of this._blobs.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this._blobs.clear();
  }

  // ─── Retrieval ────────────────────────────────────────────────────────────

  /**
   * Returns the full entry (url + data) for the given key, or null if not found.
   * @param {string|null} section
   * @param {string} key
   * @returns {{ url: string, data: BlobPart }|null}
   */
  get(section = null, key) {
    const k = this._buildKey(section, key);
    return this._blobs.get(k) ?? null;
  }

  /**
   * Returns the object URL for the given key, or null if not found.
   * @param {string|null} section
   * @param {string} key
   * @returns {string|null}
   */
  getURL(section = null, key) {
    const entry = this.get(section, key);
    return entry ? entry.url : null;
  }

  /**
   * Returns the raw Blob data for the given key, or null if not found.
   * @param {string|null} section
   * @param {string} key
   * @returns {BlobPart|null}
   */
  getData(section = null, key) {
    const entry = this.get(section, key);
    return entry ? entry.data : null;
  }

  /**
   * Returns true if an entry exists for the given key.
   * @param {string|null} section
   * @param {string} key
   * @returns {boolean}
   */
  has(section = null, key) {
    return this._blobs.has(this._buildKey(section, key));
  }

  /**
   * Returns the number of currently stored entries.
   * @returns {number}
   */
  get size() {
    return this._blobs.size;
  }

  // ─── Download ─────────────────────────────────────────────────────────────

  /**
   * Triggers a file download for a stored entry using its object URL.
   * The entry remains in the store after downloading.
   * @param {string|null} section
   * @param {string} key
   * @param {string} fileName - Base file name without extension, falls back to "untitled"
   * @param {string} extension - File extension including dot, e.g. ".pdf"
   * @returns {boolean} False if the key was not found, true otherwise
   */
  download(section = null, key, fileName, extension) {
    const url = this.getURL(section, key);
    if (!url) {
      console.error(`[BlobManager] download: no entry found for key "${this._buildKey(section, key)}"`);
      return false;
    }

    const safeName = normalizeFileName(fileName ?? 'untitled');
    this._triggerDownload(url, `${safeName}${extension}`);
    return true;
  }

  /**
   * Creates a temporary Blob from the given data, triggers a file download,
   * and immediately revokes the object URL afterwards.
   * Use this when the data does not need to be stored persistently.
   * @param {BlobPart} data - Raw data to download
   * @param {string} type - MIME type, e.g. "application/pdf"
   * @param {string} fileName - Base file name without extension, falls back to "untitled"
   * @param {string} extension - File extension including dot, e.g. ".pdf"
   */
  downloadOnce(data, type, fileName, extension) {
    const safeName = normalizeFileName(fileName ?? 'untitled');
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);

    this._triggerDownload(url, `${safeName}${extension}`);
    URL.revokeObjectURL(url);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Creates a storable entry object from a URL and its source data.
   * @param {string} url - Object URL returned by URL.createObjectURL()
   * @param {BlobPart} data - Original data the Blob was created from
   * @returns {{ url: string, data: BlobPart }}
   */
  _createEntry(url, data) {
    return { url, data };
  }

  /**
   * Builds the internal map key from an optional section and a key.
   * @param {string|null} section
   * @param {string} key
   * @returns {string} e.g. "images:avatar" or "avatar"
   */
  _buildKey(section = null, key) {
    return `${section ? `${section}:` : ''}${key}`;
  }

  /**
   * Programmatically clicks a temporary anchor element to trigger a file download.
   * The anchor is appended to and removed from the document body to ensure
   * compatibility across all browsers (including Firefox).
   * @param {string} url - Object URL or data URL to download
   * @param {string} fullName - Complete filename including extension, e.g. "report.pdf"
   */
  _triggerDownload(url, fullName) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fullName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}

export const blobManager = new BlobManager();