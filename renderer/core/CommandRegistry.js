import { isPlatformMatch, isDevelopment } from '@core/Platform.js';

/**
 * Commands of the command bar (QuickOpen '>' mode). Each command is bound to the views it is offered in,
 * like the titlebar menu items (`views`, `platform`, `developmentOnly`).
 *
 * - `label()` / `hint?()`: texts, read when the list is built (current UI language).
 * - `views?`: view ids (session.activeView) it is offered in, none = everywhere.
 * - `when?()`: false hides it (e.g. undo without anything to undo).
 * - `shortcut?` / `shortcutContext?`: its key is shown; without `run` the shortcut is dispatched.
 * - `items?()`: sub-commands. Choosing the command shows them as a list (breadcrumb: its label).
 * - `run?(ctx)`: does the command, ctx = `{ quickOpen, view }`. The command bar closes first,
 *   unless `keepOpen` (then the command closes it or calls `quickOpen.showItems()` itself).
 *
 * @typedef {Object} Command
 * @property {string} id
 * @property {() => string} label
 * @property {() => string} [hint]
 * @property {string[]} [views]
 * @property {string} [platform]
 * @property {boolean} [developmentOnly]
 * @property {() => boolean} [when]
 * @property {string} [shortcut]
 * @property {string} [shortcutContext]
 * @property {() => Command[]} [items]
 * @property {() => string} [placeholder] - search placeholder of its sub-list
 * @property {boolean} [keepOpen]
 * @property {(ctx: { quickOpen: Object, view: string }) => void} [run]
 */

/** Views with an open project (the project commands and the entry / tab search are offered there). */
export const PROJECT_VIEWS = ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor', 'languageStyleEditor'];

const _commands = [];

/** @param {Command[]} commands - added in this order */
export function registerCommands(commands) {
  _commands.push(...commands);
}

/** @returns {boolean} whether the command is offered in the view */
export function isCommandAvailable(command, view) {
  return isPlatformMatch(command.platform)
    && (!command.developmentOnly || isDevelopment())
    && (!command.views?.length || command.views.includes(view))
    && (command.when?.() ?? true);
}

/**
 * @param {string} view - session.activeView
 * @returns {Command[]} the registered commands offered in the view, in registration order
 */
export function getCommandsForView(view) {
  return _commands.filter(command => isCommandAvailable(command, view));
}
