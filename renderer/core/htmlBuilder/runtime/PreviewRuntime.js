// Runtime of the node preview iframe. Not a module: loaded as text (?raw) and
// wrapped by createNodePreviewScript() into an IIFE together with SharedRuntime.js.
// Injected by createNodePreviewScript(): scrollEl (.preview-root, always set).

var SOURCE = 'doc-preview';
var pending = false;

function getScrollPayload() {
  var scrollTop = scrollEl.scrollTop;
  var scrollHeight = scrollEl.scrollHeight;
  var clientHeight = scrollEl.clientHeight;
  var maxScroll = scrollHeight - clientHeight;
  return {
    scrollTop: scrollTop,
    scrollHeight: scrollHeight,
    clientHeight: clientHeight,
    ratio: maxScroll > 0 ? scrollTop / maxScroll : 0
  };
}

function postScroll() {
  try {
    window.parent.postMessage({ source: SOURCE, type: 'scroll', payload: getScrollPayload() }, '*');
  } catch (e) {}
}

function applyScroll(value) {
  if (value == null) 
    return;
  var top;
  if (typeof value === 'object' && value.ratio != null) {
    top = value.ratio * (scrollEl.scrollHeight - scrollEl.clientHeight);
  } else if (typeof value === 'number') {
    top = value;
  } else {
    return;
  }
  scrollEl.scrollTop = top;
}

// blocks with their source line (data-line from the parser), top relative to the scroll content
function getLineAnchors() {
  var baseTop = scrollEl.getBoundingClientRect().top - scrollEl.scrollTop;
  var visible = Array.prototype.filter.call(scrollEl.querySelectorAll('[data-line]'), function (el) {
    return el.getClientRects().length > 0;
  });
  return visible.map(function (el) {
    return {
      line: Number(el.getAttribute('data-line')),
      top: el.getBoundingClientRect().top - baseTop
    };
  });
}

scrollEl.addEventListener('scroll', () => {
  if (pending)
    return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    postScroll();
  });
}, { passive: true });

initStickyTableHead(scrollEl);
initStickyCodeCopy(scrollEl);
initTableColumnHover();
initCodeCopy();
initTocLinks();
initKeyForward();

function scrollToAnchor(id) {
  var el = id ? document.getElementById(id) : null;
  if (el) {
    revealInSections(el);
    el.scrollIntoView({ block: 'start' });
  }
}

// Reference links are handled by the editor (select the target entry)
document.addEventListener('click', e => {
  var ref = e.target.closest('.doc-ref[data-ref-node]');
  if (!ref)
    return;
  e.preventDefault();
  window.parent.postMessage({
    source: SOURCE,
    type: 'ref',
    nodeId: ref.getAttribute('data-ref-node'),
    anchor: ref.getAttribute('data-ref-anchor'),
  }, '*');
});

window.addEventListener('message', e => {
  var msg = e.data;
  if (!msg || msg.source !== SOURCE)
    return;
  if (msg.type === 'scroll:set') {
    applyScroll(msg.value);
  } else if (msg.type === 'scroll:get') {
    postScroll();
  } else if (msg.type === 'scroll:anchor') {
    scrollToAnchor(msg.anchor);
  }
});

// Direkter Zugriff, falls contentWindow verfügbar ist (same-origin, kein sandbox)
window.docPreview = {
  setScrollPosition: applyScroll,
  getScrollPosition: getScrollPayload,
  getLineAnchors: getLineAnchors,
  scrollToAnchor: scrollToAnchor
};

window.parent.postMessage({ source: SOURCE, type: 'ready' }, '*');
