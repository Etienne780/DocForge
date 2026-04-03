import { escapeHTML } from './Common.js'

/**
 * Parses a Markdown string and returns an HTML string.
 *
 * Supported syntax:
 *   # Heading 1 / ## H2 / ### H3 / #### H4
 *   **bold** / *italic* / ***bold-italic***
 *   `inline code`
 *   ```lang\n...\n```  (fenced code blocks)
 *   - unordered lists / 1. ordered lists
 *   > blockquote
 *   [text](url) links
 *   | table | cells |
 *   --- horizontal rule
 *   Paragraphs (blank-line-separated)
 *
 * @param {string} source - Raw Markdown text
 * @returns {string} HTML string
 */
export function parseMarkdown(source) {
  if (!source) return '';

  /** Extracted fenced code blocks, restored at the end */
  const codeBlockPlaceholders = [];
  /** Extracted inline code spans, restored at the end */
  const inlineCodePlaceholders = [];

  let html = source;

  // ── 1. Extract fenced code blocks (```lang\n...\n```) ─────────────────────
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlockPlaceholders.length;
    const escapedCode = escapeHTML(code.trimEnd());
    const languageTag = language
      ? `<div class="code-language-tag">${escapeHTML(language)}</div>`
      : '';
    codeBlockPlaceholders.push(
      `<div class="code-block-wrapper">
        <pre><code>${escapedCode}</code></pre>
        ${languageTag}
      </div>`
    );
    return `\x00CODEBLOCK${index}\x00`;
  });

  // ── 2. Extract inline code (`code`) ───────────────────────────────────────
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCodePlaceholders.length;
    inlineCodePlaceholders.push(`<code>${escapeHTML(code)}</code>`);
    return `\x00INLINECODE${index}\x00`;
  });

  // ── 3. Escape remaining HTML special characters ───────────────────────────
  html = html
    .replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // ── 4. Tables ─────────────────────────────────────────────────────────────
  html = html.replace(
    /((?:\|[^\n]+\|\n)+\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/g,
    match => {
      const rows = match.trim().split('\n');
      if (rows.length < 3) return match;
      const parseRow = row => row.split('|').map(cell => cell.trim()).filter(Boolean);
      const headerCells = parseRow(rows[0]);
      const bodyRows = rows.slice(2).map(parseRow);
      const headerHTML = headerCells.map(cell => `<th>${cell}</th>`).join('');
      const bodyHTML = bodyRows
        .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
        .join('');
      return `<table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>`;
    }
  );

  // ── 5. Block-level elements ───────────────────────────────────────────────
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // ── 6. Lists ──────────────────────────────────────────────────────────────
  html = html.replace(/((?:^[-*] .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').filter(line => /^[-*] /.test(line));
    return `<ul>${items.map(line => `<li>${line.replace(/^[-*] /, '')}</li>`).join('')}</ul>\n`;
  });
  html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').filter(line => /^\d+\. /.test(line));
    return `<ol>${items.map(line => `<li>${line.replace(/^\d+\. /, '')}</li>`).join('')}</ol>\n`;
  });

  // ── 7. Inline formatting ──────────────────────────────────────────────────
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');

  // ── 8. Links ──────────────────────────────────────────────────────────────
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  // ── 9. Wrap paragraphs ────────────────────────────────────────────────────
  const segments = html.split(/\n\n+/);
  html = segments.map(segment => {
    segment = segment.trim();
    if (!segment) return '';
    const isBlockElement = /^<(h[1-6]|ul|ol|blockquote|pre|div|table|hr|p)/.test(segment);
    const hasCodeBlock = /\x00CODEBLOCK/.test(segment);
    if (isBlockElement || hasCodeBlock) return segment;
    return `<p>${segment.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // ── 10. Restore extracted placeholders ───────────────────────────────────
  codeBlockPlaceholders.forEach((block, i) => {
    html = html.split(`\x00CODEBLOCK${i}\x00`).join(block);
  });
  inlineCodePlaceholders.forEach((code, i) => {
    html = html.split(`\x00INLINECODE${i}\x00`).join(code);
  });

  return html;
}