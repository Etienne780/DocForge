// Runtime of the exported document. Not a module: loaded as text (?raw) and
// wrapped by createScript() into an IIFE together with SharedRuntime.js.
// Injected by createScript(): allNodes, nodeAliases, firstNode, searchIndex.

var currentTabId = null;
var currentNodeId = null;
var isTransitioning = false;
var dynamicContent = document.getElementById('dynamicContent');

// -- Search state --------------------------------------------------------
var searchInput   = document.getElementById('searchInput');
var searchResults = document.getElementById('searchResults');
var searchResultsList = document.getElementById('searchResultsList');
var searchToggle  = document.getElementById('searchIncludeTabs');
var searchDebounceTimer = null;

// -- Helper: find node's tab --------------------------------------------
function getNodeTabId(nodeId) {
  var node = allNodes.find(n => { return n.id === nodeId; });
  return node ? node.tabId : null;
}

// -- Helper: page (and section) that shows a node ----------------------
function resolveTarget(nodeId) {
  if (!nodeId)
    return null;
  if (allNodes.some(n => { return n.id === nodeId; }))
    return { pageId: nodeId, anchor: null };
  return nodeAliases[nodeId] || null;
}

function scrollToSection(anchor) {
  if (!anchor)
    return;
  var el = document.getElementById(anchor);
  if (el && dynamicContent.contains(el)) {
    revealInSections(el);
    el.scrollIntoView();
  }
}

// Opens any node: pages directly, merged children on their page at their section.
// anchor (optional) overrides the section of the node.
function openNode(nodeId, updateUrl, onDone, anchor) {
  var target = resolveTarget(nodeId);
  if (!target) {
    onDone?.();
    return;
  }
  loadNode(target.pageId, updateUrl, onDone, () => {
    scrollToSection(anchor || target.anchor);
  });
}

// -- Header scroll-hide behaviour --------------------------------------
var docHeader = document.getElementById('docHeader');
if (docHeader && docHeader.classList.contains('header-scroll-hide')) {
  var lastScrollY = 0;
  var scrollTarget = document.querySelector('.dynamic-content') || window;
  var onScroll = () => {
    var y = (scrollTarget === window) ? window.scrollY : scrollTarget.scrollTop;
    if (y > lastScrollY && y > 60) {
      docHeader.classList.add('hidden-scrolled');
    } else {
      docHeader.classList.remove('hidden-scrolled');
    }
    lastScrollY = y;
  };
  scrollTarget.addEventListener('scroll', onScroll, { passive: true });
}

// -- TOC builder --------------------------------------------------------
var tocLinks = document.getElementById('tocLinks');
function buildToc() {
  if (!tocLinks) 
    return;
  var headings = dynamicContent.querySelectorAll('h1,h2,h3,h4');
  tocLinks.innerHTML = '';
  headings.forEach(h => {
    if (!h.id) h.id = 'h-' + Math.random().toString(36).slice(2, 7);
    var a = document.createElement('a');
    a.className = 'toc-link';
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.dataset.level = h.tagName[1];
    a.addEventListener('click', e => {
      e.preventDefault();
      revealInSections(h);
      h.scrollIntoView({ behavior: 'smooth' });
    });
    tocLinks.appendChild(a);
  });
}

// -- Sidebar toggle ------------------------------------------------------
var docRoot = document.getElementById('docRoot');
var navBackdrop = document.getElementById('navBackdrop');
var toggleButtons = [
  document.getElementById('navToggleBtn')
].filter(Boolean);
var closeBtn = document.getElementById('navCloseBtn');

function setSidebarCollapsed(collapsed, persist) {
  docRoot.classList.toggle('sidebar-collapsed', collapsed);
  toggleButtons.forEach(btn => {
    btn.setAttribute('aria-expanded', String(!collapsed));
  });
  if (persist) {
    try { sessionStorage.setItem('_docSidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
  }
}

function toggleSidebar() {
  setSidebarCollapsed(!docRoot.classList.contains('sidebar-collapsed'), true);
}

toggleButtons.forEach(btn => {
  btn.addEventListener('click', toggleSidebar);
});

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    setSidebarCollapsed(true, true);
  });
}

navBackdrop.addEventListener('click', () => {
  setSidebarCollapsed(true, true);
});

// When the sidebar floats over the content (position: fixed, e.g. on
// mobile), close it after a node was picked. Only if it can be reopened.
var navContainer = document.querySelector('.nav-container');
function collapseOverlaySidebar() {
  var isOverlay = navContainer && getComputedStyle(navContainer).position === 'fixed';
  if (isOverlay && toggleButtons.length > 0) {
    setSidebarCollapsed(true, true);
  }
}

// Default: open on desktop, closed on mobile — unless the user already
// picked a state this session. Never auto-collapse if there is no way
// to reopen the sidebar again (no toggle button rendered, e.g.
// header-show:'sidebar'/'never').
(function initSidebarState() {
  var stored = null;
  try { stored = sessionStorage.getItem('_docSidebarCollapsed'); } catch (e) {}

  var canReopen = toggleButtons.length > 0;
  var collapsed = stored !== null
    ? stored === '1'
    : (canReopen && window.innerWidth <= 768);

  setSidebarCollapsed(collapsed, false);
})();

// -- Load node content from template with crossfade ---------------------
// onContent sets the scroll position while the new content is still hidden,
// so the top of the page doesn't flash before jumping to an anchor.
function loadNode(nodeId, updateUrl, onDone, onContent) {
  if (isTransitioning) {
    onDone?.();
    return;
  }

  if (nodeId === currentNodeId) {
    onContent?.();
    onDone?.();
    return;
  }

  var template = document.getElementById('tmpl-' + nodeId);
  if (!template) {
    console.warn('Template not found for node', nodeId);
    onDone?.(); 
    return;
  }

  var newTabId = getNodeTabId(nodeId);
  if (!newTabId) { 
    onDone?.(); 
    return;
  }

  // only switch the sidebar, loading the tab's first node would flash it
  var activeTabSection = document.querySelector('.sidebar-section.active');
  if (activeTabSection && activeTabSection.dataset.tab !== newTabId)
    activateTab(newTabId);

  isTransitioning = true;
  dynamicContent.classList.add('fade-out');

  setTimeout(() => {
    var clone = document.importNode(template.content, true);
    dynamicContent.innerHTML = '';
    dynamicContent.appendChild(clone);
    dynamicContent.scrollTop = 0;
    buildToc();
    onContent?.();

    document.querySelectorAll('.nav-row').forEach(row => {
      row.classList.remove('active');
    });
    document.querySelectorAll('.nav-row[data-node-id="' + nodeId + '"]').forEach(row => {
      row.classList.add('active');
    });

    currentNodeId = nodeId;
    currentTabId = newTabId;

    if (updateUrl !== false && window.location.hash !== '#' + nodeId) {
      history.pushState(null, '', '#' + nodeId);
    }

    dynamicContent.classList.remove('fade-out');
    setTimeout(() => {
      isTransitioning = false;
      onDone?.(); 
    }, 50);
  }, 150);
}

// -- Tab switching -----------
function activateTab(tabId) {
  document.querySelectorAll('.sidebar-section').forEach(s => {
    s.classList.toggle('active', s.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  try {
    sessionStorage.setItem('_docActiveTab', tabId);
  } catch (e) {}
}

function switchTab(tabId, callback) {
  activateTab(tabId);

  var firstNodeInTab = allNodes.find(n => n.tabId === tabId);
  if (firstNodeInTab) {
    loadNode(firstNodeInTab.id, true, callback);
  } else {
    dynamicContent.innerHTML = '<div class="main"><p>No content in this tab.</p></div>';
    currentNodeId = null;
    currentTabId = tabId;
    callback?.();
  }
}

// -- Nav group toggle --------------------------------------
function toggleNavGroup(groupId) {
  var group = document.getElementById(groupId);
  if (!group)
    return;
  group.classList.toggle('collapsed');
}

// -- Search helpers ------------------------------------------------------

/** Escapes a string for safe insertion as HTML text content. */
function _escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns the HTML-escaped string with all occurrences of query
 * wrapped in <mark> tags for highlighting.
 */
function _highlight(text, query) {
  if (!query || !text)
    return _escHtml(text);
  var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(' + escaped + ')', 'gi');
  return _escHtml(text).replace(re, '<mark>$1</mark>');
}

/**
 * Returns a short excerpt of text centred around the first occurrence
 * of query, padded by radius characters on each side.
 */
function _getSnippet(text, query, radius) {
  radius = radius || 80;
  if (!text)
    return '';
  if (!query)
    return text.slice(0, radius * 2);
  var idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) 
    return text.slice(0, radius * 2);
  var start = Math.max(0, idx - radius);
  var end   = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? '\u2026' : '') + text.slice(start, end) + (end < text.length ? '\u2026' : '');
}

/**
 * Scores a single index entry against the query string.
 * Returns { score, matchedHeading }.
 *
 * Score weights:
 *   title match   +100
 *   heading match  +50  (first matched heading captured)
 *   content match  +10
 */
function _scoreEntry(entry, query) {
  var ql = query.toLowerCase();
  var score = 0;
  var matchedHeading = null;

  if (entry.title.toLowerCase().indexOf(ql) >= 0)
    score += 100;

  for (var i = 0; i < entry.headings.length; i++) {
    if (entry.headings[i].toLowerCase().indexOf(ql) >= 0) {
      score += 50;
      if (!matchedHeading) matchedHeading = entry.headings[i];
    }
  }

  if (entry.content.toLowerCase().indexOf(ql) >= 0)
    score += 10;

  return { score: score, matchedHeading: matchedHeading };
}

/**
 * Executes a search over the index and renders results into the
 * floating results panel. Hides the panel when query is empty.
 */
function _runSearch(query) {
  if (!searchResultsList)
    return;

  query = (query || '').trim();

  if (query.length < 2) {
    searchResults.classList.remove('visible');
    searchResultsList.innerHTML = '';
    return;
  }

  // Scope: current tab only, or all tabs when toggle is checked.
  var crossTab = searchToggle ? searchToggle.checked : false;
  var pool = crossTab
    ? searchIndex
    : searchIndex.filter(e => { return e.tabId === currentTabId; });

  var scored = [];
  for (var i = 0; i < pool.length; i++) {
    var res = _scoreEntry(pool[i], query);
    if (res.score > 0)
      scored.push({ entry: pool[i], score: res.score, matchedHeading: res.matchedHeading });
  }

  scored.sort((a, b) => { return b.score - a.score; });
  var top = scored.slice(0, 20);

  if (top.length === 0) {
    searchResultsList.innerHTML = '<div class="search-no-results">No results found</div>';
    searchResults.classList.add('visible');
    return;
  }

  searchResultsList.innerHTML = top.map(item => {
    var e = item.entry;
    var snippet = _getSnippet(e.content, query, 80);
    var headingHtml = item.matchedHeading
      ? '<div class="search-result-heading">' + _highlight(item.matchedHeading, query) + '</div>'
      : '';
    return '<div class="search-result" data-node-id="' + _escHtml(e.nodeId) + '">'
      + '<div class="search-result-title">'   + _highlight(e.title, query) + '</div>'
      + headingHtml
      + '<div class="search-result-preview">' + _highlight(snippet, query) + '</div>'
      + '</div>';
  }).join('');

  searchResults.classList.add('visible');
}

// -- Event handling -----------------------------------------------------

// Reference links ([[slug]]): open the target page and scroll to the anchor
document.body.addEventListener('click', e => {
  var ref = e.target.closest('.doc-ref[data-ref-node]');
  if (!ref)
    return;
  e.preventDefault();
  openNode(ref.getAttribute('data-ref-node'), true, null, ref.getAttribute('data-ref-anchor'));
});

// Sidebar-Clicks (Delegation): chevrons/folders toggle, nodes load
document.body.addEventListener('click', e => {
  var btn = e.target.closest('[data-toggle-group]');
  if (btn && btn.dataset.toggleGroup) {
    e.preventDefault();
    toggleNavGroup(btn.dataset.toggleGroup);
    return;
  }

  var link = e.target.closest('.nav-row[data-node-id]');
  if (link && link.getAttribute('data-node-id')) {
    e.preventDefault();
    loadNode(link.getAttribute('data-node-id'), true);
    collapseOverlaySidebar();
  }
});

// Tab-Clicks
var tabNav = document.getElementById('tabNav');
if (tabNav) {
  tabNav.addEventListener('click', e => {
    var btn = e.target.closest('.tab-btn');
    if (btn && btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    }
  });
}

var tabNavContainer = document.getElementById('tabNavContainer');
if (tabNavContainer) {
  // Convert vertical scroll to horizontal scroll
  tabNavContainer.addEventListener('wheel', (e) => {
    if (e.deltaY === 0)
      return;
  
    e.preventDefault(); // prevent vertical scroll
    tabNavContainer.scrollBy({
      left: e.deltaY,
      behavior: 'smooth'
    });
  }, { passive: false });
}

window.addEventListener('hashchange', () => {
  var hash = window.location.hash.slice(1);
  if (resolveTarget(hash)) {
    openNode(hash, false);
  } else if (firstNode) {
    loadNode(firstNode.id, true);
  }
});

// -- Search event handling ----------------------------------------------

if (searchInput) {
  // Debounced input -> run search after 120 ms of silence.
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    var val = searchInput.value;
    searchDebounceTimer = setTimeout(() => {
      _runSearch(val);
    }, 120);
  });

  // Re-show results on focus if there is a pending query.
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2 && searchResultsList)
      searchResults.classList.add('visible');
  });
}

// Result clicks: navigate to node and close panel.
if (searchResultsList) {
  searchResultsList.addEventListener('click', e => {
    var item = e.target.closest('.search-result');
    if (!item)
      return;
    
    var nodeId = item.getAttribute('data-node-id');
    searchResults.classList.remove('visible');
    
    if (searchInput)
      searchInput.value = '';
    if (nodeId)
      openNode(nodeId, true);
  });
}

// Close results when clicking anywhere outside the search widget.
document.addEventListener('click', e => {
  if (!searchResultsList)
    return;
  var docSearch = document.getElementById('docSearch');
  if (docSearch && !docSearch.contains(e.target))
    searchResults.classList.remove('visible');
});

// -- Externe Navigation (postMessage) ------------------------------------
var NAV_SOURCE = 'doc-nav';
var navScrollPending = false;

function getLocationPayload() {
  var scrollTop = dynamicContent.scrollTop;
  var scrollHeight = dynamicContent.scrollHeight;
  var clientHeight = dynamicContent.clientHeight;
  var maxScroll = scrollHeight - clientHeight;
  return {
    tabId: currentTabId,
    nodeId: currentNodeId,
    scrollTop: scrollTop,
    scrollHeight: scrollHeight,
    clientHeight: clientHeight,
    ratio: maxScroll > 0 ? scrollTop / maxScroll : 0
  };
}

function postLocation() {
  try {
    window.parent.postMessage({ source: NAV_SOURCE, type: 'location', payload: getLocationPayload() }, '*');
  } catch (e) {
  }
}

dynamicContent.addEventListener('scroll', function () {
  if (navScrollPending)
    return;
  navScrollPending = true;
  requestAnimationFrame(function () {
    navScrollPending = false;
    postLocation();
  });
}, { passive: true });

initStickyTableHead(dynamicContent);
initStickyCodeCopy(dynamicContent);
initTableColumnHover();
initCodeCopy();
initTocLinks();
initKeyForward();

function applyExternalScroll(scrollPosition) {
  if (scrollPosition == null) 
    return;
  var top;
  if (typeof scrollPosition === 'object' && scrollPosition.ratio != null) {
    top = scrollPosition.ratio * (dynamicContent.scrollHeight - dynamicContent.clientHeight);
  } else if (typeof scrollPosition === 'number') {
    top = scrollPosition;
  } else {
    return;
  }
  dynamicContent.scrollTop = top;
}

function handleExternalNavigate(msg) {
  var target = resolveTarget(msg.nodeId) || resolveTarget(currentNodeId);
  var applyPosition = function () {
    if (msg.scrollPosition == null)
      scrollToSection(target && target.anchor);
    applyExternalScroll(msg.scrollPosition);
  };
  if (target && target.pageId !== currentNodeId) {
    loadNode(target.pageId, true, postLocation, applyPosition);
  } else {
    applyPosition();
    postLocation();
  }
}

window.addEventListener('message', function (e) {
  var msg = e.data;
  if (!msg || msg.source !== NAV_SOURCE)
    return;
  if (msg.type === 'navigate') {
    handleExternalNavigate(msg);
  } else if (msg.type === 'location:get') {
    postLocation();
  }
});

// Direkter Zugriff, falls contentWindow verfügbar ist
window.docNav = {
  navigate: function (opts) { handleExternalNavigate(opts || {}); },
  getLocation: getLocationPayload
};

// -- Initialization ---------------------------------------
var savedTab = null;
try { 
  savedTab = sessionStorage.getItem('_docActiveTab'); 
} catch (e) {
}
var initialTab = (savedTab && allNodes.some(n => { 
    return n.tabId === savedTab; 
  })
) ? savedTab : (firstNode ? firstNode.tabId : null);

var hashTarget = resolveTarget(window.location.hash.slice(1));
var initialNodeId = null;
if (hashTarget) {
  initialNodeId = hashTarget.pageId;
} else if (firstNode) {
  initialNodeId = firstNode.id;
}

if (initialTab) {
  document.querySelectorAll('.sidebar-section').forEach(s => {
    s.classList.toggle('active', s.dataset.tab === initialTab);
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === initialTab);
  });
}

if (initialNodeId) {
  loadNode(initialNodeId, false, () => {
    postLocation();
    window.parent.postMessage({ source: NAV_SOURCE, type: 'ready' }, '*');
  }, () => {
    scrollToSection(hashTarget && hashTarget.anchor);
  });
} else {
  postLocation();
  window.parent.postMessage({ source: NAV_SOURCE, type: 'ready' }, '*');
}
