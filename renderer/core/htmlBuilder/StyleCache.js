import { blobManager } from '@core/BlobManager.js';
import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';
import { DOC_THEME_BLOB_SECTION, getLanguageStyleId } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';
import { buildCombinedCSS } from './ThemeCss.js';

// ─── Theme & Language Style Cache ─────────────────────────────────────────────

export function buildLanguageCssForContent(project, content, theme) {
  const urls = getCachedLanguageStyle(project, content, theme, 'url');
  let html = '';

  urls.forEach((u) => {
    html += `    <link rel="stylesheet" href="${u}">\n`;
  });

  return html;
}

export function buildLanguageCssForProject(project, theme, type) {
  const allData = new Set();

  const collectDataFromContent = (content) => {
    if (!content) 
      return;
    const data = getCachedLanguageStyle(project, content, theme, type); // returns a Set
    for (const d of data) {
      allData.add(d);
    }
  };

  const traverseNodes = (nodes) => {
    for (const node of nodes) {
      collectDataFromContent(node.content);
      if (node.children?.length) 
        traverseNodes(node.children);
    }
  };

  for (const tab of project.tabs) {
    if (tab.nodes?.length) 
      traverseNodes(tab.nodes);
  }

  // Combine all CSS data into a single string

  if (type === 'data') {
    return Array.from(allData).join('\n');
  } else if (type === 'url') {
    let html = '';
    allData.forEach((u) => {
      html += `    <link rel="stylesheet" href="${u}">\n`;
    });
    return html;
  } else {
    console.warn(`[htmlBuilder.js]: buildLanguageCssForProject unknown type '${type}'`);
    return null;
  }
}

function getCachedThemeStyleEntry(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  const themeId = resolvedTheme.id ?? '__default__';

  const entry = blobManager.get(DOC_THEME_BLOB_SECTION, themeId);
  if (entry)
    return entry;

  const css = buildCombinedCSS(resolvedTheme);
  const newEntry = blobManager.add(DOC_THEME_BLOB_SECTION, themeId, { 
    data: css, 
    type: 'text/css',
  });
  return newEntry;
}

export function getCachedThemeStyleUrl(theme) {
  return getCachedThemeStyleEntry(theme).url;
}

export function getCachedThemeStyleContent(theme) {
  return getCachedThemeStyleEntry(theme).data;
}

export function getCachedLanguageStyle(project, content, theme, type) {
  const tags = _getLanguageTagsByText(content);
  const results = new Set();

  if (!theme || !project)
    return results;

  tags.forEach(tag => {
    const def = findSyntaxDefinitionByName(tag, project.languages);
    if (!def || def.id === null)
      return;

    const styleId = getLanguageStyleId(project, theme, def);
    if (styleId === null)
      return;

    const entry = syntaxHighlighter.getLanguageBlobEntry(def.id, styleId);
    if (entry && entry[type]) {
      results.add(entry[type]);
    }
  });

  return results;
}

function _getLanguageTagsByText(text) {
  // Keep in sync with the fenced-code regex in MarkdownParser.js — must also
  // accept '#', '+', '.', '-' so languages like C#, C++, F# are matched,
  // and an optional ':lang' suffix for ```diff:lang blocks.
  const matches = [...text.matchAll(/```([\w#+.-]+(?::[\w#+.-]+)?)\n/g)];

  const tags = matches.map(m => {
    const langSpec = m[1];
    const [prefix, lang] = langSpec.split(':');
    // For ```diff:javascript the real language is javascript, not 'diff'.
    // For a plain ```diff with no suffix, langSpec is just 'diff' — return it as-is.
    return prefix === 'diff' ? (lang || prefix) : langSpec;
  });

  // inline code with a language: {lang=cpp}`code`
  for (const m of text.matchAll(/\{[^{}\n]*\blang=([\w#+.-]+)[^{}\n]*\}`/g))
    tags.push(m[1]);

  return tags;
}

export function revokeThemeCache(id) {
  if(id) {
    blobManager.remove(DOC_THEME_BLOB_SECTION, id);
  } else {
    blobManager.removeSection(DOC_THEME_BLOB_SECTION);
  }
}
