import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';

/** Areas of the appearance manager gallery (session.appearanceManagerDisplay). */
export const APPEARANCE_DISPLAYS = ['all', 'doc', 'lan'];

/**
 * Opens the appearance manager, optionally on one area and with the creation dialog of a
 * doc theme or language open. If it is already open, only switches the area / opens the dialog.
 * @param {Object} [options]
 * @param {'all'|'doc'|'lan'|null} [options.display] - area of the gallery, null keeps the last one
 * @param {'theme'|'language'|null} [options.create] - opens the creation dialog of that type
 */
export function openAppearanceManager({ display = null, create = null } = {}) {
  if (APPEARANCE_DISPLAYS.includes(display))
    session.set('appearanceManagerDisplay', display);

  if (session.get('activeView') === 'appearanceManager') {
    if (create)
      eventBus.emit('appearanceManager:create', { type: create });
    return;
  }
  eventBus.emit('navigate:appearanceManager', create ? { create } : {});
}
