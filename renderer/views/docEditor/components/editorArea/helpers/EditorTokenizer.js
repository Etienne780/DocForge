/**
 * EditorTokenizer - line based Markdown tokenizer for the editor highlighting.
 *
 * Every line is tokenized on its own with the state the previous line ended with
 * (open code fence, open comment, open property block), so the highlighter only
 * has to re-tokenize changed lines. Returns HTML with `ehl-<token>` classes,
 * the token names match EDITOR_COLOR_TOKENS in @common/EditorColors.js.
 * The syntax follows @core/MarkdownParser.js.
 */

/**
 * @typedef {Object} LineState
 * @property {string|null} fence - backticks of the open code fence
 * @property {boolean} comment   - inside <!-- -->
 * @property {boolean} props     - inside a multi-line property block { ... }
 */

/** @type {LineState} */
export const INITIAL_LINE_STATE = Object.freeze({ fence: null, comment: false, props: false });

/** @returns {string} compares two line states */
export function lineStateKey(state) {
  return `${state.fence ?? ''}|${state.comment ? 1 : 0}|${state.props ? 1 : 0}`;
}

const FENCE_REGEX = /^([ \t]*)(`{3,})([\w#+.-]+(?::[\w#+.-]+)?)?(.*)$/;
const HEADING_REGEX = /^(#{1,4})( .*)$/;
const HR_REGEX = /^---[ \t]*$/;
const TOC_REGEX = /^[ \t]*\[toc\][ \t]*$/i;
const FOOTNOTE_DEF_REGEX = /^(\[\^[^\]\s]+\]:)(.*)$/;
const QUOTE_REGEX = /^(>)( .*)$/;
const LIST_REGEX = /^([ \t]*)([-*]|\d+\.|n\.)( .*)$/;
const CHECK_MARK_REGEX = /^ (\[[ xX]\])(?= |$)/;
const TABLE_REGEX = /^[ \t]*\|/;
const PROPERTY_LINE_REGEX = /^([ \t]*)\{(.*)\}([ \t]*)$/;
const PROPERTY_OPEN_REGEX = /^[ \t]*\{[ \t]*$/;
const PROPERTY_CLOSE_REGEX = /^[ \t]*\}[ \t]*$/;
const BLANK_REGEX = /^[ \t]*$/;
const PROPERTY_TOKEN_REGEX = /([a-zA-Z][\w-]*)(?:(=)("[^"\n]*"|[^\s;"]+))?/g;

const INLINE_SOURCE = [
  '(?<comment><!--)',
  '(?<codeProps>\\{[^{}\\n]*\\})?(?<ticks>`+)(?<code>.*?)\\k<ticks>(?!`)',
  '\\[\\[(?<slug>[^\\]|\\n]+?)(?:\\|[^\\]\\n]*)?\\]\\]',
  '(?<anchor>\\{#[a-z0-9-]+\\})',
  '\\[\\^(?<footnote>[^\\]\\s]+)\\]',
  '\\[(?<linkText>[^\\]]+)\\]\\((?<linkUrl>[^)]+)\\)',
  '\\*\\*\\*(?<boldItalic>.+?)\\*\\*\\*',
  '\\*\\*(?<bold>.+?)\\*\\*',
  '\\*(?<italic>[^*\\n]+?)\\*',
  '(?<![\\w])_(?<underscore>[^_\\n]+?)_(?![\\w])',
  '(?<!\\\\)(?<pipe>\\|)',
].join('|');

/**
 * @param {string} line
 * @param {LineState} state - state at the start of the line
 * @param {object} [options]
 * @param {(slug: string) => boolean} [options.isRefValid] - [[slug]] links that return false are marked as broken
 * @param {(label: string) => boolean} [options.isFootnoteValid] - [^label] references without a definition (false) are marked
 * @returns {{ html: string, state: LineState }} state at the end of the line
 */
export function tokenizeLine(line, state, { isRefValid = () => true, isFootnoteValid = () => true } = {}) {
  const ctx = { state: { ...state }, isRefValid, isFootnoteValid, table: false };
  return { html: _line(line, ctx), state: ctx.state };
}

function _line(line, ctx) {
  const state = ctx.state;

  if (state.fence) {
    const close = _findFence(line, state.fence);
    if (close < 0)
      return _span('code-block', line);

    const ticks = state.fence;
    state.fence = null;
    return _span('code-block', line.slice(0, close))
      + _span('markup', ticks)
      + _inline(line.slice(close + ticks.length), ctx);
  }

  if (state.comment) {
    const end = line.indexOf('-->');
    if (end < 0)
      return _span('comment', line);

    state.comment = false;
    return _span('comment', line.slice(0, end + 3)) + _inline(line.slice(end + 3), ctx);
  }

  if (state.props) {
    if (PROPERTY_CLOSE_REGEX.test(line)) {
      state.props = false;
      return _span('markup', line);
    }
    // like the parser: a blank line ends an unclosed block
    if (BLANK_REGEX.test(line)) {
      state.props = false;
      return _escape(line);
    }
    return _properties(line);
  }

  return _block(line, ctx);
}

function _block(line, ctx) {
  const fence = line.match(FENCE_REGEX);
  if (fence) {
    const [, indent, ticks, lang = '', after] = fence;
    const head = _escape(indent) + _span('markup', ticks) + _span('code-block', lang);
    const close = _findFence(after, ticks);
    if (close < 0) {
      ctx.state.fence = ticks;
      return head + _span('code-block', after);
    }
    return head
      + _span('code-block', after.slice(0, close))
      + _span('markup', ticks)
      + _inline(after.slice(close + ticks.length), ctx);
  }

  const propertyLine = line.match(PROPERTY_LINE_REGEX);
  if (propertyLine && !propertyLine[2].startsWith('#')) {
    const [, indent, content, trail] = propertyLine;
    return _escape(indent) + _span('markup', '{') + _properties(content) + _span('markup', '}') + _escape(trail);
  }

  if (PROPERTY_OPEN_REGEX.test(line)) {
    ctx.state.props = true;
    return _span('markup', line);
  }

  const heading = line.match(HEADING_REGEX);
  if (heading)
    return `<span class="ehl-heading">${_span('markup', heading[1])}${_inline(heading[2], ctx)}</span>`;

  if (HR_REGEX.test(line) || TOC_REGEX.test(line))
    return _span('markup', line);

  const footnote = line.match(FOOTNOTE_DEF_REGEX);
  if (footnote)
    return _span('ref', footnote[1]) + _inline(footnote[2], ctx);

  const quote = line.match(QUOTE_REGEX);
  if (quote)
    return `<span class="ehl-quote">${_span('markup', quote[1])}${_inline(quote[2], ctx)}</span>`;

  const list = line.match(LIST_REGEX);
  if (list) {
    // check mark `[ ]` / `[x]` directly after the marker
    const check = list[3].match(CHECK_MARK_REGEX);
    if (check)
      return _escape(list[1]) + _span('list', list[2]) + ' ' + _span('list', check[1]) + _inline(list[3].slice(check[0].length), ctx);
    return _escape(list[1]) + _span('list', list[2]) + _inline(list[3], ctx);
  }

  ctx.table = TABLE_REGEX.test(line);
  return _inline(line, ctx);
}

function _inline(text, ctx) {
  if (!text)
    return '';

  // own instance: _inline() is called recursively for bold/italic/link text
  const regex = new RegExp(INLINE_SOURCE, 'g');
  let html = '';
  let last = 0;
  let match;

  while ((match = regex.exec(text))) {
    html += _escape(text.slice(last, match.index));
    const groups = match.groups;
    last = match.index + match[0].length;

    if (groups.comment) {
      const end = text.indexOf('-->', match.index + 4);
      if (end < 0) {
        ctx.state.comment = true;
        return html + _span('comment', text.slice(match.index));
      }
      html += _span('comment', text.slice(match.index, end + 3));
      last = end + 3;
      regex.lastIndex = last;
    } else if (groups.ticks) {
      if (groups.codeProps)
        html += _span('markup', '{') + _properties(groups.codeProps.slice(1, -1)) + _span('markup', '}');
      html += _span('code', groups.ticks + groups.code + groups.ticks);
    } else if (groups.slug !== undefined) {
      html += _span(ctx.isRefValid(groups.slug.trim()) ? 'ref' : 'ref-broken', match[0]);
    } else if (groups.anchor) {
      html += _span('anchor', match[0]);
    } else if (groups.footnote !== undefined) {
      html += _span(ctx.isFootnoteValid(groups.footnote) ? 'ref' : 'ref-broken', match[0]);
    } else if (groups.linkText !== undefined) {
      html += _span('markup', '[')
        + `<span class="ehl-link">${_inline(groups.linkText, ctx)}</span>`
        + _span('markup', '](')
        + _span('link-url', groups.linkUrl)
        + _span('markup', ')');
    } else if (groups.boldItalic !== undefined) {
      html += _wrap('ehl-bold ehl-italic', '***', groups.boldItalic, ctx);
    } else if (groups.bold !== undefined) {
      html += _wrap('ehl-bold', '**', groups.bold, ctx);
    } else if (groups.italic !== undefined) {
      html += _wrap('ehl-italic', '*', groups.italic, ctx);
    } else if (groups.underscore !== undefined) {
      html += _wrap('ehl-italic', '_', groups.underscore, ctx);
    } else if (groups.pipe) {
      html += ctx.table ? _span('table', '|') : '|';
    }
  }

  return html + _escape(text.slice(last));
}

/** name=value pairs of a property block */
function _properties(text) {
  let html = '';
  let last = 0;

  for (const match of text.matchAll(PROPERTY_TOKEN_REGEX)) {
    const [, name, equals, value] = match;
    html += _escape(text.slice(last, match.index)) + _span('property', name);
    if (equals)
      html += _span('markup', equals) + _span('property-value', value);
    last = match.index + match[0].length;
  }

  return html + _escape(text.slice(last));
}

function _wrap(className, marker, inner, ctx) {
  return `<span class="${className}">${_span('markup', marker)}${_inline(inner, ctx)}${_span('markup', marker)}</span>`;
}

/** Index of exactly `ticks` (not part of a longer backtick run), -1 if missing. */
function _findFence(text, ticks) {
  const match = new RegExp(`(?<!\`)${ticks}(?!\`)`).exec(text);
  return match ? match.index : -1;
}

function _span(token, text) {
  return text ? `<span class="ehl-${token}">${_escape(text)}</span>` : '';
}

function _escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
