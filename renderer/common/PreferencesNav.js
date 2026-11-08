import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { t } from '@core/i18n/I18n.js';

/**
 * Sections of the preferences view (views/preferences), in this order.
 * The ids are used by openPreferences() and the File -> Preferences menu.
 * label / menuDescription are read in the current UI language (preferences.sections.<id>).
 */
export const PREFERENCE_SECTIONS = [
  'general',
  'editor',
  'app-theme',
  'theme-editor',
  'hotkeys',
].map(id => ({
  id,
  get label() { return t(`preferences.sections.${id}.label`); },
  get menuDescription() { return t(`preferences.sections.${id}.menuDescription`); },
}));

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
