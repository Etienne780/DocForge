// core/documentIO/WebDocumentIOAdapter.js
//
// Web no longer keeps a live reference to an opened project file. Opening/importing a
// project on web is a one-time read (see ImportHelper.js / Toolbar.js), and the full
// project snapshot - not a file reference - is what gets stored in `recentProjects`.
//
// This adapter exists only so DocumentManager can pick an adapter per platform without
// special-casing web; it inherits the "not supported" defaults from DocumentIOAdapter.
import { DocumentIOAdapter } from './DocumentIOAdapter.js';

export class WebDocumentIOAdapter extends DocumentIOAdapter {}
