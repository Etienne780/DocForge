import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { registerCommands, getCommandsForView, isCommandAvailable, PROJECT_VIEWS } from '@core/CommandRegistry.js';
import { QuickOpen, QUICK_OPEN_PREFIX } from '@common/QuickOpen.js';
import { openPreferences, PREFERENCE_SECTIONS } from '@common/PreferencesNav.js';
import { openAppearanceManager } from '@common/AppearanceNav.js';
import { needsLeaveConfirm, resolveLeaveOpenProject } from '@common/UnsavedChangesGuard.js';
import { getOpenProject, revealOpenProject, closeProject, openRecentProject } from '@data/ProjectManager.js';
import { getRecentEntryIds } from '@data/EntryHistory.js';
import { undoProjectChange, redoProjectChange, canUndo, canRedo, getUndoLabel, getRedoLabel } from '@data/ProjectHistory.js';
import {
  getDocThemes, getPresetDocThemes, getCurrentTheme, setCurrentTheme, openDocThemeEditor,
} from '@data/DocThemeManager.js';
import { getLanguages, openSyntaxDefinitionEditor } from '@data/SyntaxDefinitionManager.js';
import { t } from '@core/i18n/I18n.js';

/**
 * The app-wide command bar (@common/QuickOpen.js) and its commands (@core/CommandRegistry.js).
 * Opened by 'quickOpen:open' ({ query? }): Navigate:quickOpen / quickOpenTabs / quickOpenEntries
 * (views with a project), Navigate:commands (everywhere) and the search field of the title bar.
 */

const tr = key => () => t(`commands.${key}`);
const view = () => session.get('activeView');
const byName = (a, b) => (a.name ?? '').localeCompare(b.name ?? '');
const ownThemes = () => getDocThemes(getOpenProject()).filter(theme => !theme.builtIn).sort(byName);
const ownLanguages = () => getLanguages(getOpenProject()).filter(lang => !lang.builtIn).sort(byName);

/** Views with a project, without the given one (e.g. "go to doc editor" not in the doc editor). */
const projectViewsExcept = (...views) => PROJECT_VIEWS.filter(v => !views.includes(v));

/**
 * Runs `action` once the open project may be left. With unsaved changes the bar shows the
 * choices as sub-commands: save and leave, discard and leave, cancel (Escape also cancels).
 */
function leaveOpenProjectThen(quickOpen, action) {
  if (!needsLeaveConfirm()) {
    quickOpen.close();
    action();
    return;
  }

  const leaveWith = choice => async () => {
    if (await resolveLeaveOpenProject(choice))
      action();
  };
  quickOpen.showItems({
    label: t('commands.unsaved.title', { name: getOpenProject()?.name ?? '' }),
    placeholder: t('commands.unsaved.placeholder'),
    items: () => [
      { id: 'unsaved-save',    label: tr('unsaved.saveAndLeave'),    run: leaveWith('save') },
      { id: 'unsaved-discard', label: tr('unsaved.discardAndLeave'), danger: true, run: leaveWith('discard') },
      { id: 'unsaved-cancel',  label: tr('unsaved.cancel'),          run: () => {} },
    ],
  });
}

/** Recent projects without the open one, last opened first. */
function recentProjectCommands() {
  const openId = getOpenProject()?.id;
  return (state.get('recentProjects') ?? [])
    .filter(recent => recent.id !== openId)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .map(recent => ({
      id: `open-recent:${recent.id}`,
      label: () => recent.name ?? '',
      hint: () => recent.sourcePath ?? '',
      keepOpen: true,
      run: ({ quickOpen }) => {
        if (!getOpenProject()) {
          quickOpen.close();
          openRecentProject(recent.id);
          return;
        }
        leaveOpenProjectThen(quickOpen, () => {
          closeProject();
          openRecentProject(recent.id);
        });
      },
    }));
}

function docThemeActivateCommands() {
  const project = getOpenProject();
  const currentId = getCurrentTheme(project)?.id;
  const toCommand = (theme, builtIn) => ({
    id: `activate-theme:${theme.id}`,
    label: () => theme.name ?? '',
    hint: () => [builtIn ? t('commands.theme.builtIn') : '', theme.id === currentId ? t('commands.theme.active') : '']
      .filter(Boolean).join(' · '),
    run: () => {
      setCurrentTheme(project, theme.id, builtIn);
      eventBus.emit('save:request');
      eventBus.emit('toast:show', { message: t('appearance.themes.activated'), type: 'success' });
    },
  });
  return [
    ...ownThemes().map(theme => toCommand(theme, false)),
    ...[...getPresetDocThemes()].sort(byName).map(theme => toCommand(theme, true)),
  ];
}

/** @type {import('@core/CommandRegistry.js').Command[]} */
const COMMANDS = [
  // ─── Search modes (stay in the bar) ──────────────────────────────────────
  { id: 'search-all',     label: tr('search.all'),     views: PROJECT_VIEWS, shortcut: 'Navigate:quickOpen',        keepOpen: true, run: ({ quickOpen }) => quickOpen.setQuery('') },
  { id: 'search-tabs',    label: tr('search.tabs'),    views: PROJECT_VIEWS, shortcut: 'Navigate:quickOpenTabs',    keepOpen: true, run: ({ quickOpen }) => quickOpen.setQuery(QUICK_OPEN_PREFIX.tabs) },
  { id: 'search-entries', label: tr('search.entries'), views: PROJECT_VIEWS, shortcut: 'Navigate:quickOpenEntries', keepOpen: true, run: ({ quickOpen }) => quickOpen.setQuery(QUICK_OPEN_PREFIX.entries) },

  // ─── Navigation ──────────────────────────────────────────────────────────
  {
    id: 'go-doc-editor', label: tr('navigate.docEditor'), views: projectViewsExcept('docEditor'),
    shortcut: 'Navigate:docEditor', run: () => eventBus.emit('navigate:docEditor'),
  },
  {
    id: 'go-appearance', label: tr('navigate.appearance'), views: projectViewsExcept('appearanceManager'),
    shortcut: 'Navigate:appearance', run: () => openAppearanceManager(),
  },
  {
    id: 'go-appearance-themes', label: tr('navigate.appearanceThemes'), views: PROJECT_VIEWS,
    shortcut: 'Navigate:appearanceThemes', run: () => openAppearanceManager({ display: 'doc' }),
  },
  {
    id: 'go-appearance-languages', label: tr('navigate.appearanceLanguages'), views: PROJECT_VIEWS,
    shortcut: 'Navigate:appearanceLanguages', run: () => openAppearanceManager({ display: 'lan' }),
  },
  {
    id: 'leave-project', label: tr('navigate.leaveProject'), views: PROJECT_VIEWS, keepOpen: true,
    run: ({ quickOpen }) => leaveOpenProjectThen(quickOpen, () => eventBus.emit('navigate:projectHub')),
  },

  // ─── Doc themes and languages ─────────────────────────────────────────────
  {
    id: 'theme-create', label: tr('theme.create'), views: PROJECT_VIEWS,
    run: () => openAppearanceManager({ display: 'doc', create: 'theme' }),
  },
  {
    id: 'theme-edit', label: tr('theme.edit'), placeholder: tr('theme.editPlaceholder'), views: PROJECT_VIEWS,
    when: () => ownThemes().length > 0,
    items: () => ownThemes().map(theme => ({
      id: `edit-theme:${theme.id}`,
      label: () => theme.name ?? '',
      run: () => openDocThemeEditor(getOpenProject(), theme),
    })),
  },
  {
    id: 'theme-activate', label: tr('theme.activate'), placeholder: tr('theme.activatePlaceholder'), views: PROJECT_VIEWS,
    items: docThemeActivateCommands,
  },
  {
    id: 'language-create', label: tr('language.create'), views: PROJECT_VIEWS,
    run: () => openAppearanceManager({ display: 'lan', create: 'language' }),
  },
  {
    id: 'language-edit', label: tr('language.edit'), placeholder: tr('language.editPlaceholder'), views: PROJECT_VIEWS,
    when: () => ownLanguages().length > 0,
    items: () => ownLanguages().map(lang => ({
      id: `edit-language:${lang.id}`,
      label: () => lang.name ?? '',
      run: () => openSyntaxDefinitionEditor(getOpenProject(), lang),
    })),
  },

  // ─── Project ─────────────────────────────────────────────────────────────
  {
    id: 'project-save', label: tr('project.save'), views: ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor'],
    shortcut: 'SaveOpenProject',
  },
  { id: 'save-all', label: tr('project.saveAll'), shortcut: 'Save', shortcutContext: 'global' },
  {
    id: 'edit-undo', label: tr('project.undo'), hint: () => getUndoLabel() ?? '', when: () => canUndo(),
    shortcut: 'Edit:undo', shortcutContext: 'global', run: () => undoProjectChange(),
  },
  {
    id: 'edit-redo', label: tr('project.redo'), hint: () => getRedoLabel() ?? '', when: () => canRedo(),
    shortcut: 'Edit:redo', shortcutContext: 'global', run: () => redoProjectChange(),
  },
  { id: 'project-export',         label: tr('project.export'),        views: ['docEditor'], shortcut: 'ExportProject' },
  { id: 'project-preview-export', label: tr('project.previewExport'), views: ['docEditor'], shortcut: 'PreviewExport' },
  {
    id: 'project-save-template', label: tr('project.saveAsTemplate'), views: ['docEditor'],
    run: () => eventBus.emit('show:modal:createTemplate', { project: getOpenProject() }),
  },
  {
    id: 'project-settings', label: tr('project.settings'), views: ['docEditor'],
    run: () => eventBus.emit('show:modal:projectSettings', { project: getOpenProject() }),
  },
  {
    id: 'project-reveal', label: tr('project.reveal'), platform: '!web', views: ['docEditor', 'appearanceManager'],
    run: () => revealOpenProject(),
  },

  // ─── Projects ────────────────────────────────────────────────────────────
  {
    id: 'project-create', label: tr('project.create'), views: ['projectHub', ...PROJECT_VIEWS],
    shortcut: 'CreateNewProject', run: () => eventBus.emit('show:modal:createProject'),
  },
  {
    id: 'project-import', label: tr('project.import'), views: ['projectHub', ...PROJECT_VIEWS],
    run: () => eventBus.emit('show:modal:importProject'),
  },
  {
    id: 'project-open-recent', label: tr('project.openRecent'), placeholder: tr('project.openRecentPlaceholder'),
    views: ['projectHub', ...PROJECT_VIEWS], when: () => recentProjectCommands().length > 0,
    items: recentProjectCommands,
  },

  // ─── App ─────────────────────────────────────────────────────────────────
  // flat (only a few sections): "Preferences: open" and "Preferences: <section>"
  {
    id: 'preferences', label: tr('app.preferences'),
    shortcut: 'OpenPreferences', shortcutContext: 'global', run: () => openPreferences(),
  },
  ...PREFERENCE_SECTIONS.map(section => ({
    id: `preferences-${section.id}`,
    label: () => t('commands.app.preferencesSection', { section: section.label }),
    hint: () => section.menuDescription,
    run: () => openPreferences(section.id),
  })),
  {
    id: 'dark-mode', label: tr('app.darkMode'),
    run: () => {
      const isDark = !state.get('isDarkMode');
      state.set('isDarkMode', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    },
  },
  { id: 'backups',   label: tr('app.backups'),   run: ({ view }) => eventBus.emit('show:modal:backupManager', { view }) },
  { id: 'overview',  label: tr('app.overview'),  run: ({ view }) => eventBus.emit('show:modal:overview', { view }) },
  { id: 'changelog', label: tr('app.changelog'), run: ({ view }) => eventBus.emit('show:modal:changelog', { view }) },
  { id: 'info',      label: tr('app.info'),      run: ({ view }) => eventBus.emit('show:modal:info', { view }) },
];

/** Registers the commands and creates the command bar. Call once at bootstrap, after the shortcuts. */
export function initCommands() {
  registerCommands(COMMANDS);

  const quickOpen = new QuickOpen({
    getProject: () => PROJECT_VIEWS.includes(view()) ? getOpenProject() : null,
    getView: view,
    getCommands: () => getCommandsForView(view()),
    filterCommands: list => list.filter(command => isCommandAvailable(command, view())),
    getRecentIds: () => getRecentEntryIds(getOpenProject()),
    // the open entry is left out only where it is shown
    getActiveId: () => view() === 'docEditor' ? session.get('activeNodeId') : null,
    getActiveTabId: () => session.get('activeTabId'),
    onOpen: ({ tabId, nodeId }) => {
      if (view() === 'docEditor')
        eventBus.emit('editor:open-node', { nodeId });
      else
        eventBus.emit('navigate:docEditor', { open: { tabId, nodeId } });
    },
    // like the tab selector of the left sidebar
    onOpenTab: tabId => {
      if (view() !== 'docEditor') {
        eventBus.emit('navigate:docEditor', { open: { tabId } });
        return;
      }
      session.set('activeTabId', tabId);
      session.set('activeNodeId', null);
    },
    // opens over the search field of the title bar, so it looks like that field
    getAnchor: () => document.querySelector('.topbar__quick-open:not(.hidden)'),
  });

  eventBus.on('quickOpen:open', ({ query = '' } = {}) => quickOpen.open(query));
  eventBus.on('session:change:activeView', () => quickOpen.close());
}
