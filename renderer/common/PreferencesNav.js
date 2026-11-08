import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';

/**
 * Sections of the preferences view (views/preferences), in this order.
 * The ids are used by openPreferences() and the File -> Preferences menu.
 */
export const PREFERENCE_SECTIONS = [
  { id: 'general',       label: 'General' },
  { id: 'editor',        label: 'Doc editor' },
  { id: 'app-theme',     label: 'App theme' },
  { id: 'theme-editor',  label: 'Theme editor' },
  { id: 'hotkeys',       label: 'Hotkeys' },
];

/**
 * Opens the preferences, scrolled to a section. If they are already open, only scrolls.
 * 'hotkeys' opens the hotkeys modal over the current view instead.
 * @param {string|null} [section] - id from PREFERENCE_SECTIONS
 */
export function openPreferences(section = null) {
  if (section === 'hotkeys') {
    import('@common/HotkeysModal.js').then(({ openHotkeysModal }) => openHotkeysModal());
    return;
  }
  if (session.get('activeView') === 'preferences')
    eventBus.emit('preferences:show-section', { section });
  else
    eventBus.emit('navigate:preferences', { section });
}
