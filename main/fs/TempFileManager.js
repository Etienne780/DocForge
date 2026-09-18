import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

class TempFileManager {
  constructor(options = {}) {
    this.appPrefix = options.appPrefix || 'app-name';
    this.maxAgeMs = options.maxAgeMs || 10 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60 * 1000;

    this.trackedPaths = new Set();
    this.directories = new Set();
    this.cleanupTimer = null;
  }

  start() {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(() => {
        // Ignore background cleanup errors.
      });
    }, this.cleanupIntervalMs);

    this.cleanupTimer.unref();
  }

  stop() {
    if (!this.cleanupTimer) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  generateTmpName(filename) {
    const id = crypto.randomUUID();

    return `.${this.appPrefix}.${filename}.${process.pid}.${id}.tmp`;
  }

  createTempPath(absolutePath) {
    const directory = path.dirname(absolutePath);
    const filename = path.basename(absolutePath);
    const tempName = this.generateTmpName(filename);
    const tempPath = path.join(directory, tempName);

    this.directories.add(directory);
    this.trackedPaths.add(tempPath);

    return tempPath;
  }

  forget(tempPath) {
    this.trackedPaths.delete(tempPath);
  }

  isTmpFile(filename) {
    const escapedPrefix = this.appPrefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const pattern = new RegExp(
      `^\\.${escapedPrefix}\\..+\\.\\d+\\.[a-f0-9-]+\\.tmp$`,
      'i'
    );

    return pattern.test(filename);
  }

  async cleanup() {
    const now = Date.now();

    for (const directory of this.directories) {
      let entries;
      try {
        entries = await fs.promises.readdir(directory, {
          withFileTypes: true
        });
      } catch {
        this.directories.delete(directory);
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !this.isTmpFile(entry.name))
          continue;

        const tempPath = path.join(directory, entry.name);

        let stats;
        try {
          stats = await fs.promises.stat(tempPath);
        } catch {
          this.trackedPaths.delete(tempPath);
          continue;
        }

        const age = now - stats.mtimeMs;
        if (age < this.maxAgeMs) 
          continue;

        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // Ignore files that cannot be removed.
        }

        this.trackedPaths.delete(tempPath);
      }
    }
  }
}

export const tempFileManager = new TempFileManager({
  appPrefix: 'doc-forge',
  maxAgeMs: 10 * 60 * 1000,
  cleanupIntervalMs: 60 * 1000
});