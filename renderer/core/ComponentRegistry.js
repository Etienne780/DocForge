// `X.css` is loaded as text and scoped to the container (ScopedCss.js), `X.global.css` is loaded
// unscoped as it is (rules for modals / popups in document.body).
export const componentRegistry = {
  js:   import.meta.glob('../common/components/*/*.js'),
  html: import.meta.glob('../common/components/*/*.html', { query: '?raw', import: 'default' }),
  css:  import.meta.glob(['../common/components/*/*.css', '!../common/components/*/*.global.css'], { query: '?raw', import: 'default' }),
  globalCss: import.meta.glob('../common/components/*/*.global.css', { query: '?url', import: 'default' }),

  viewsJs:   import.meta.glob(['../views/**/*.js',   '!../views/**/helpers/*.js']),
  viewsHtml: import.meta.glob(['../views/**/*.html', '!../views/**/helpers/*.html'], { query: '?raw', import: 'default' }),
  viewsCss:  import.meta.glob(['../views/**/*.css',  '!../views/**/helpers/*.css', '!../views/**/*.global.css'], { query: '?raw', import: 'default' }),
  viewsGlobalCss: import.meta.glob('../views/**/*.global.css', { query: '?url', import: 'default' }),
};
