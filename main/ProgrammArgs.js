const OPENABLE_EXTENSIONS = [
  '.dfproj',
  '.dftheme',
  '.dflang'
];

/**
 * Checks whether a single path has one of our supported file extensions.
 */
export function isOpenableFile(arg) {
  return OPENABLE_EXTENSIONS.some(ext => arg.toLowerCase().endsWith(ext));
}

/**
 * Extracts ALL supported file paths from an argv list.
 * Returns an array (empty if no matching files are present).
 *
 * Note: argv[0] is the exe itself, and argv[1] is usually the app path (".")
 * for unpackaged Electron apps. Neither ever matches our extensions anyway,
 * so a simple filter over all arguments is enough.
 */
export function getFilesFromArgv(argv) {
  return argv.filter(isOpenableFile);
}