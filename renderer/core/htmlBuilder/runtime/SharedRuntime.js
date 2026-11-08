// Shared runtime of the exported document (DocumentRuntime.js) and the node
// preview (PreviewRuntime.js). Not a module: loaded as text (?raw) and placed
// inside the IIFE of each script, the init functions are called from there.

/**
 * Opens every collapsed section (::: Title) around el, so a link / toc / search
 * target inside it can be scrolled to.
 */
function revealInSections(el) {
  var section = el && el.closest ? el.closest('details.doc-section') : null;
  while (section) {
    section.open = true;
    section = section.parentElement ? section.parentElement.closest('details.doc-section') : null;
  }
}

/** [toc] links (MarkdownParser): scroll to the heading instead of changing the URL hash (page navigation). */
function initTocLinks() {
  document.addEventListener('click', function (e) {
    // [toc] links and footnotes: scroll to the target instead of changing the hash
    var link = e.target.closest('a[data-toc-target]');
    if (!link)
      return;
    e.preventDefault();
    var heading = document.getElementById(link.getAttribute('data-toc-target'));
    if (heading) {
      revealInSections(heading);
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

/**
 * {copy} button of code blocks. Copies the code without line numbers; diff
 * blocks copy the new version (without removed lines).
 */
function initCodeCopy() {
  function getCodeText(wrapper) {
    var diffLines = wrapper.querySelectorAll('.code-block-diff-line:not(.code-block-diff-removed)');
    if (diffLines.length) {
      return Array.prototype.map.call(diffLines, function (line) { return line.textContent; })
        .join('\n').replace(/^\u00A0$/gm, '');
    }
    var source = wrapper.querySelector('pre');
    return source ? source.textContent.replace(/^\u00A0$/gm, '') : '';
  }
  function copyWithBuffer(text) {
    var buffer = document.createElement('textarea');
    buffer.className = 'code-copy-buffer';
    buffer.value = text;
    buffer.setAttribute('readonly', '');
    document.body.appendChild(buffer);
    buffer.select();
    try { document.execCommand('copy'); } catch (e) {}
    buffer.remove();
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(text).catch(function () { copyWithBuffer(text); });
    copyWithBuffer(text);
    return Promise.resolve();
  }
  document.addEventListener('click', function (e) {
    var button = e.target.closest && e.target.closest('.code-copy-btn');
    var wrapper = button && button.closest('.code-block-wrapper');
    if (!wrapper)
      return;
    copyText(getCodeText(wrapper)).then(function () {
      button.textContent = 'Copied';
      clearTimeout(button._copyTimeout);
      button._copyTimeout = setTimeout(function () { button.textContent = 'Copy'; }, 1500);
    });
  });
}

/**
 * Keeps the {copy} button of code blocks visible while the content scrolls
 * through a block (same approach as initStickyTableHead).
 * @param {HTMLElement} scrollEl  The scroll container.
 */
function initStickyCodeCopy(scrollEl) {
  var codeCopyPending = false;
  function updateCodeCopyButtons() {
    codeCopyPending = false;
    var stickTop = scrollEl.getBoundingClientRect().top;
    var copies = scrollEl.querySelectorAll('.code-copy');

    // measure all buttons first, then write (see buildStickyTableHeadJs)
    var offsets = [];
    copies.forEach(function (copy) {
      // the row isn't always at the top of the wrapper (numbered blocks have the tag above)
      var naturalTop = copy.getBoundingClientRect().top - (copy._offset || 0);
      var wrapperBottom = copy.parentElement.getBoundingClientRect().bottom;
      var button = copy.firstElementChild;
      var maxOffset = Math.max(wrapperBottom - naturalTop - (button ? button.offsetHeight : 0) - 16, 0);
      offsets.push(Math.min(Math.max(stickTop - naturalTop, 0), maxOffset));
    });

    copies.forEach(function (copy, i) {
      if ((copy._offset || 0) === offsets[i])
        return;
      copy._offset = offsets[i];
      copy.style.transform = offsets[i] ? 'translateY(' + offsets[i] + 'px)' : '';
    });
  }
  scrollEl.addEventListener('scroll', function () {
    if (codeCopyPending)
      return;
    codeCopyPending = true;
    requestAnimationFrame(updateCodeCopyButtons);
  }, { passive: true });
}

/**
 * {hover=col} tables: marks every cell of the hovered column with
 * .tbl-hover-col (row and cell hover are plain CSS).
 */
function initTableColumnHover() {
  var hoveredCells = [];
  var hoveredCell = null;
  function clearColumn() {
    hoveredCells.forEach(function (cell) { cell.classList.remove('tbl-hover-col'); });
    hoveredCells = [];
    hoveredCell = null;
  }
  document.addEventListener('mouseover', function (e) {
    var cell = e.target.closest && e.target.closest('table[data-hover~="col"] th, table[data-hover~="col"] td');
    if (cell === hoveredCell)
      return;
    clearColumn();
    if (!cell)
      return;
    hoveredCell = cell;
    cell.closest('table').querySelectorAll('tr').forEach(function (tr) {
      var columnCell = tr.cells[cell.cellIndex];
      if (columnCell) {
        columnCell.classList.add('tbl-hover-col');
        hoveredCells.push(columnCell);
      }
    });
  });
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget)
      clearColumn();
  });
}

/**
 * Keeps table headers visible while the content scrolls. Tables sit in a
 * horizontally scrolling wrapper, where position: sticky can't follow the
 * page scroll, so the thead is shifted down instead.
 * @param {HTMLElement} scrollEl  The scroll container.
 */
function initStickyTableHead(scrollEl) {
  var tableHeadPending = false;
  function updateTableHeads() {
    tableHeadPending = false;
    var stickTop = scrollEl.getBoundingClientRect().top;
    var heads = scrollEl.querySelectorAll('.table-wrapper thead');

    // measure all tables first, then write: measuring after a write forces a new layout per table
    var transforms = [];
    heads.forEach(function (thead) {
      var tableRect = thead.parentElement.getBoundingClientRect();
      // only a table whose top scrolled above the edge and that is still in view needs a shift
      if (tableRect.top >= stickTop || tableRect.bottom <= stickTop) {
        transforms.push('');
        return;
      }
      var maxOffset = Math.max(tableRect.height - thead.offsetHeight, 0);
      // 1px less: the header also covers the top border line
      var offset = Math.min(stickTop - tableRect.top, maxOffset) - 1;
      transforms.push(offset > 0 ? 'translateY(' + offset + 'px)' : '');
    });

    heads.forEach(function (thead, i) {
      if (thead.style.transform !== transforms[i])
        thead.style.transform = transforms[i];
    });
  }
  scrollEl.addEventListener('scroll', function () {
    if (tableHeadPending)
      return;
    tableHeadPending = true;
    requestAnimationFrame(updateTableHeads);
  }, { passive: true });
}

/**
 * Forwards key events not handled inside the iframe to the parent document,
 * so app shortcuts also work while the preview has focus. Dispatches
 * synchronously (same-origin blob iframe), so a shortcut that prevents the
 * forwarded event also prevents the original one. Presses (pointerdown /
 * mousedown, no click) are dispatched on the iframe element, so the app's
 * outside-press handlers close open menus and popups. Does nothing when the
 * page is not embedded (exported HTML).
 */
function initKeyForward() {
  if (window.parent === window)
    return;
  function forwardKey(e) {
    if (e.defaultPrevented)
      return;
    try {
      var forwarded = new window.parent.KeyboardEvent(e.type, {
        key: e.key,
        code: e.code,
        location: e.location,
        repeat: e.repeat,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        bubbles: true,
        cancelable: true
      });
      if (!window.parent.document.dispatchEvent(forwarded))
        e.preventDefault();
    } catch (err) {}
  }
  window.addEventListener('keydown', forwardKey);
  window.addEventListener('keyup', forwardKey);

  function forwardPress(e) {
    var frame = window.frameElement;
    if (!frame)
      return;
    try {
      var rect = frame.getBoundingClientRect();
      var Type = e.type === 'pointerdown' ? window.parent.PointerEvent : window.parent.MouseEvent;
      frame.dispatchEvent(new Type(e.type, {
        button: e.button,
        buttons: e.buttons,
        clientX: e.clientX + rect.left,
        clientY: e.clientY + rect.top,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        pointerType: e.pointerType,
        bubbles: true,
        cancelable: true
      }));
    } catch (err) {}
  }
  window.addEventListener('pointerdown', forwardPress, true);
  window.addEventListener('mousedown', forwardPress, true);
}
