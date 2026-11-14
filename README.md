# DocForge

An Electron-based tool for writing and organizing project documentation.

DocForge lets you write documentation in Markdown, organize it into tabs, pages and folders, style it with your own themes and export it as a standalone HTML site.

## Features

- **Document editor** with a live preview, split mode and a page tree with tabs, folders and merged pages
- **Extended Markdown**: tables with highlights, stripes and custom column widths, code blocks with line numbers and a copy button, comments, reference links
- **Syntax highlighting** for 45+ languages, with your own language definitions and highlight styles
- **Theme editor** for colors, fonts, spacing and layout of your documents
- **HTML export** as a responsive site with a sidebar and search
- **Project hub** with recent projects and templates
- **Backups** of unsaved changes and recovery after a crash
- **Import / export** of projects (`.dfproj`), themes (`.dftheme`), language definitions (`.dflang`), highlight styles (`.dflangstyle`) and app themes (`.dfapptheme`)
- **Auto updates** on Windows and Linux

## Download

Download the latest version for Windows, macOS or Linux from the [Releases](https://github.com/Etienne780/DocForge/releases) page. The installed app updates automatically on Windows and Linux. On macOS, new versions have to be downloaded manually.

## Development

Requires [Node.js](https://nodejs.org/) (version 22 is used in CI).

```bash
npm install
npm run dev
```

| Script | Description |
|---|---|
| `npm run dev` | Runs the Vite dev server and Electron in development mode |
| `npm run build` | Builds the renderer for production (`renderer/dist`) |
| `npm run start` | Runs Electron with the production build |
| `npm run dist` | Packages the app with electron-builder (`dist:win`, `dist:mac`, `dist:linux` for a single platform) |
| `npm run clean` | Removes the build output |

Further documentation:

- [DEV_REFERENCE.md](DEV_REFERENCE.md): architecture, state, events, APIs and the release process
- [CHANGELOG.md](CHANGELOG.md): changes per version
- [ROADMAP.md](ROADMAP.md): planned features

## License

[MIT](LICENSE) © 2026 Brot780
