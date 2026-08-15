export const VIEW_ROUTES = {
  'navigate:appLoader':             () => import('../views/appLoader/AppLoaderView.js').then(m => m.AppLoaderView),
  'navigate:projectHub':            () => import('../views/projectHub/ProjectHubView.js').then(m => m.ProjectHubView),
  'navigate:docEditor':             () => import('../views/docEditor/DocEditorView.js').then(m => m.DocEditorView),
  'navigate:appearanceManager':     () => import('../views/appearanceManager/AppearanceManagerView.js').then(m => m.AppearanceManagerView),
  'navigate:themeEditor':           () => import('../views/themeEditor/ThemeEditorView.js').then(m => m.ThemeEditorView),
  'navigate:languageEditor':        () => import('../views/languageEditor/LanguageEditorView.js').then(m => m.LanguageEditorView),
  'navigate:languageStyleEditor':   () => import('../views/languageStyleEditor/LanguageStyleEditorView.js').then(m => m.LanguageStyleEditorView),
};
