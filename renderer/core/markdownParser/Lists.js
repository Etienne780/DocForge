// ─── Lists ────────────────────────────────────────────────────────────────────

const TASK_ITEM_REGEX = /^\[([ xX])\](?: (.*))?$/;

/**
 * Opens a list item. `[ ] text` / `[x] text` become a check mark item with a
 * box that can't be clicked (the bullet is replaced, numbers stay).
 * @param {string} content - item text after the list marker
 * @param {number|null} [value] - number shown for an ordered list item
 * @returns {string}
 */
function buildListItemOpen(content, value = null) {
  const valueAttr = value !== null ? ` value="${value}"` : '';
  const task = content.match(TASK_ITEM_REGEX);
  if (!task)
    return `<li${valueAttr}>${content}`;

  const checked = task[1] !== ' ';
  const box = `<span class="task-box${checked ? ' task-box--checked' : ''}" aria-hidden="true"></span>`;
  return `<li class="task-item${checked ? ' task-item--checked' : ''}"${valueAttr}>${box}${task[2] ?? ''}`;
}

export const LIST_BULLETS = ['disc', 'circle', 'square', 'dash', 'arrow', 'none'];

/**
 * Bullet style per nesting level from the `bullet` property: one style for all
 * levels, or a comma list that repeats (bullet=disc,dash -> disc, dash, disc, ...).
 * Without it every level gets the default class (CSS: disc, circle, square).
 * @param {BlockProperties|null} properties
 * @returns {(level: number) => string} class attribute of the <ul>
 */
function getBulletClass(properties) {
  const value = properties?.props.bullet;
  const styles = typeof value === 'string' ? value.split(',').filter(s => LIST_BULLETS.includes(s)) : [];
  return level => styles.length ? ` class="md-bullets--${styles[level % styles.length]}"` : '';
}

/**
 * Parses unordered lists, with the property block above (`bullet`) if there is one.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function parseUnorderedLists(ctx) {
  ctx.html = ctx.html.replace(
    /(?:^\x03P(\d+)\x03\n)?((?:^(?: {2,4})*[-*] .+$\n?)+)/gm,
    (_, propertiesIndex, match) => {
      const lines = match.trimEnd().split('\n');
      const bulletClass = getBulletClass(propertiesIndex !== undefined ? ctx.properties[propertiesIndex] : null);

      function buildList(startIndex, baseIndent, level = 0) {
        let html = `<ul${bulletClass(level)}>`;
        let i = startIndex;

        while (i < lines.length) {
          const line = lines[i];
          const match = line.match(/^(\s*)[-*] (.+)$/);

          if (!match) {
            break;
          }

          const indent = match[1].length;

          if (indent < baseIndent) {
            break;
          }

          if (indent > baseIndent) {
            const [nested, nextIndex] = buildList(i, indent, level + 1);
            html += nested;
            i = nextIndex;
            continue;
          }

          html += buildListItemOpen(match[2]);

          if (i + 1 < lines.length) {
            const nextMatch = lines[i + 1].match(/^(\s*)[-*] (.+)$/);

            if (nextMatch && nextMatch[1].length > baseIndent) {
              const [nested, nextIndex] = buildList(i + 1, nextMatch[1].length, level + 1);
              html += nested;
              i = nextIndex;
            } else {
              i++;
            }
          } else {
            i++;
          }

          html += '</li>';
        }

        html += '</ul>';
        return [html, i];
      }

      return buildList(0, lines[0].match(/^(\s*)/)[1].length)[0] + '\n';
    }
  );

  return ctx;
}

/**
 * Parses ordered lists. Every item shows the number it is written with,
 * `n.` continues with the next number after the previous item (first item: 1).
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function parseOrderedLists(ctx) {
  const ITEM_REGEX = /^(\s*)(\d+|n)\. (.+)$/;

  ctx.html = ctx.html.replace(
    /((?:^(?: {2,4})*(?:\d+|n)\. .+$\n?)+)/gm,
    match => {
      const lines = match.trimEnd().split('\n');

      function buildList(startIndex, baseIndent) {
        let html = '<ol>';
        let i = startIndex;
        let number = 0;

        while (i < lines.length) {
          const line = lines[i];
          const match = line.match(ITEM_REGEX);

          if (!match) {
            break;
          }

          const indent = match[1].length;

          if (indent < baseIndent) {
            break;
          }

          if (indent > baseIndent) {
            const [nested, nextIndex] = buildList(i, indent);
            html += nested;
            i = nextIndex;
            continue;
          }

          const written = match[2] === 'n' ? null : Number(match[2]);
          const value = written ?? number + 1;
          html += buildListItemOpen(match[3], value !== number + 1 ? value : null);
          number = value;

          if (i + 1 < lines.length) {
            const nextMatch = lines[i + 1].match(ITEM_REGEX);

            if (nextMatch && nextMatch[1].length > baseIndent) {
              const [nested, nextIndex] = buildList(
                i + 1,
                nextMatch[1].length
              );

              html += nested;
              i = nextIndex;
            } else {
              i++;
            }
          } else {
            i++;
          }

          html += '</li>';
        }

        html += '</ol>';
        return [html, i];
      }

      return buildList(0, lines[0].match(/^(\s*)/)[1].length)[0] + '\n';
    }
  );

  return ctx;
}
