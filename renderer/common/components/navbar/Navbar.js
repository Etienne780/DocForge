import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { closeProject, getOpenProject, getActiveTab, getNodePath, findNode } from '@data/ProjectManager.js';
import { escapeHTML } from '@common/Common.js';

const FALLBACK_LABELS = {
  themeEditor: 'Theme',
  languageEditor: 'Sprachen',
  languageStyleEditor: 'Styles',
};

export default class Navbar extends Component {

  onLoad() {
    this._actions = this._buildQuickActions();

    this._setupElementEvents();
    this._render();

    this.subscribe('session:change:activeView', () => this._render());
    this.subscribe('session:change:openProject', () => this._render());
    this.subscribe('session:change:activeTabId', () => this._render());
    this.subscribe('session:change:activeNodeId', () => this._render());
    this.subscribe('session:change:navContext', () => this._render());
  }

  _setupElementEvents() {
    const navbar = this.element('navbar');
    navbar.addEventListener('wheel', (e) => {
      if (e.deltaY === 0)
        return;

      e.preventDefault(); // prevent vertical scroll
      navbar.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    }, { passive: false });
  }

  // ─── Segment builders ─────────────────────────────────────────────────────

  _buildDocEditorSegments(project) {
    const segments = [{ label: project.name }];

    const activeTab = getActiveTab();
    if (!activeTab)
      return segments;

    segments.push({ label: activeTab.name });

    const nodeId = session.get('activeNodeId');
    if (!nodeId)
      return segments;

    const path = getNodePath(nodeId) ?? [findNode(nodeId)].filter(Boolean);
    path.forEach(node => segments.push({ label: node.name, nodeId: node.id }));

    return segments;
  }

  _buildSubViewSegments(project, view) {
    const ctx = session.get('navContext');
    const segments = [{ label: project.name, event: 'navigate:docEditor' }];

    if (ctx?.path?.length)
      segments.push(...ctx.path);
    else
      segments.push({ label: FALLBACK_LABELS[view] ?? view });

    return segments;
  }

  // ─── Rendering ──────────────────────────────────────────────────────────

  _render() {
    const navbar = this.element('navbar');
    const view = session.get('activeView');
    const project = getOpenProject();

    const segments = [{ label: 'Hub', event: 'navigate:projectHub' }];

    if (project && view && view !== 'projectHub') {
      segments.push(...(view === 'docEditor'
        ? this._buildDocEditorSegments(project)
        : this._buildSubViewSegments(project, view)));
    }

    navbar.innerHTML = segments
      .map((seg, i) => this._renderSegment(seg, i === segments.length - 1))
      .join('<span class="app__navbar_separator">›</span>');

    this._bindSegmentClicks(navbar);
    this._renderActions(this._actions.filter(a => a.view === view));
  }

  _renderSegment(seg, isCurrent) {
    const label = escapeHTML(seg.label);

    if (isCurrent)
      return `<span class="app__navbar_segment app__navbar_segment--current">${label}</span>`;

    const clickable = !!(seg.event || seg.nodeId);
    const cls = `app__navbar_segment${clickable ? ' app__navbar_segment--link' : ''}`;
    const attrs = seg.event
      ? `data-nav-event="${seg.event}" data-nav-props='${JSON.stringify(seg.props ?? {})}'`
      : seg.nodeId
        ? `data-node-id="${seg.nodeId}"`
        : '';

    return `<span class="${cls}" ${attrs}>${label}</span>`;
  }

  _bindSegmentClicks(navbar) {
    navbar.querySelectorAll('[data-nav-event]').forEach(el => {
      el.addEventListener('click', () => {
        const props = JSON.parse(el.dataset.navProps || '{}');
        eventBus.emit(el.dataset.navEvent, props);
      });
    });
    navbar.querySelectorAll('[data-node-id]').forEach(el => {
      el.addEventListener('click', () => session.set('activeNodeId', el.dataset.nodeId));
    });
  }

  _buildQuickActions() {
    return [
      {
        view: 'docEditor',
        label: 'Appearance',
        onClick: () => eventBus.emit('navigate:appearanceManager'),
      },
      {
        view: 'appearanceManager',
        label: 'Editor',
        onClick: () => eventBus.emit('navigate:docEditor'),
      },
    ];
  }

  _renderActions(actions) {
    const el = this.element('actions');
    if (!el)
      return;

    el.innerHTML = actions.map((a, i) => `
      <button class="button button--secondary" id="${this.elementId('action-' + i)}">
        ${escapeHTML(a.label)}
      </button>
    `).join('');

    actions.forEach((a, i) => this.element(`action-${i}`)?.addEventListener('click', a.onClick));
  }

}