const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    icon: 'assets/icons/logo',
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel', // Windows Installer
      config: {
        setupIcon: 'assets/icons/icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip', // ZIP für macOS
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb', // Linux Debian
      config: {
        icon: 'assets/icons/icon.png'
      },
    },
    {
      name: '@electron-forge/maker-rpm', // Linux RedHat/Fedora
      config: {
        icon: 'assets/icons/icon.png'
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
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