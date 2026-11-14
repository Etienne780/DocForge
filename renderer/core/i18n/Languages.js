/**
 * Languages of the app UI. Every string entry (core/i18n/strings) has a text per id.
 * No imports here: State.js uses this list too (allowed values of state.uiLanguage).
 *
 * name is written in the language itself, it is never translated.
 */
export const UI_LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
];

export const UI_LANGUAGE_IDS = UI_LANGUAGES.map(language => language.id);

/** Used when a text is missing and when 'auto' finds no supported system language. */
export const FALLBACK_UI_LANGUAGE = 'en';

/** state.uiLanguage: 'auto' follows the system language. */
export const UI_LANGUAGE_AUTO = 'auto';
