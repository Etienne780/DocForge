export const componentRegistry = {
  js:   import.meta.glob('../common/components/*/*.js'),
  html: import.meta.glob('../common/components/*/*.html', { query: '?raw', import: 'default' }),
  css:  import.meta.glob('../common/components/*/*.css',  { query: '?url', import: 'default' }),

  viewsJs:   import.meta.glob(['../views/**/*.js',   '!../views/**/helpers/*.js']),
  viewsHtml: import.meta.glob(['../views/**/*.html', '!../views/**/helpers/*.html'], { query: '?raw', import: 'default' }),
  viewsCss:  import.meta.glob(['../views/**/*.css',  '!../views/**/helpers/*.css'],  { query: '?url', import: 'default' }),
};