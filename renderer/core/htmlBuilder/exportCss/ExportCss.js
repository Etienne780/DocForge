// Static CSS of the export and the previews, split by element. The files are
// loaded as text (?raw) and joined in this order (later rules win), because the
// CSS is written into the exported HTML / preview iframes, where @import of
// other files would not resolve. `/* @generated ... */` placeholders are filled
// in by buildBaseCSS() in ThemeCss.js.
import base from './Base.css?raw';
import layout from './Layout.css?raw';
import text from './Text.css?raw';
import codeBlocks from './CodeBlocks.css?raw';
import toc from './Toc.css?raw';
import lists from './Lists.css?raw';
import footnotes from './Footnotes.css?raw';
import tree from './Tree.css?raw';
import sections from './Sections.css?raw';
import tables from './Tables.css?raw';
import search from './Search.css?raw';

export const EXPORT_CSS = [
  base,
  layout,
  text,
  codeBlocks,
  toc,
  lists,
  footnotes,
  tree,
  sections,
  tables,
  search,
].join('\n');
