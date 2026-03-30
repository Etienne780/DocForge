const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    // icon: 'path/to/icon', //electronforge.io/guides/create-and-add-icons
    asar: true, // Packt den Code in eine ASAR-Datei
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel', // Windows Installer
      config: {},
    },
    {
      name: '@electron-forge/maker-zip', // ZIP für macOS
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb', // Linux Debian
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm', // Linux RedHat/Fedora
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives', // Natives automatisch auspacken
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};