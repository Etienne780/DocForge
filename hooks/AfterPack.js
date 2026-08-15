import fs from "fs";
import path from "path";
import plist from "plist";

export default async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const projectRoot = path.resolve(packager.projectDir);
  const iconsRoot = path.join(projectRoot, "assets", "icons");

  if (electronPlatformName === "darwin") {
    const appPath = path.join(appOutDir, "DocForge.app");
    const contentsPath = path.join(appPath, "Contents");
    const resourcesPath = path.join(contentsPath, "Resources");
    const plistPath = path.join(contentsPath, "Info.plist");
    const documentTypes = [
      {
        ext: "dfproj",
        icon: "dfproj.icns",
        name: "DocForge Project"
      },
      {
        ext: "dftheme",
        icon: "dftheme.icns",
        name: "DocForge Theme"
      },
      {
        ext: "dflang",
        icon: "dflang.icns",
        name: "DocForge Language Definition"
      }
    ];
    for (const type of documentTypes) {
      const source = path.join(
        iconsRoot,
        type.ext,
        type.icon
      );
      const target = path.join(
        resourcesPath,
        type.icon
      );
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
      }
    }
    const plistData = plist.parse(
      fs.readFileSync(plistPath, "utf8")
    );
    plistData.CFBundleDocumentTypes = documentTypes.map((type) => ({
      CFBundleTypeExtensions: [type.ext],
      CFBundleTypeName: type.name,
      CFBundleTypeRole: "Editor",
      CFBundleTypeIconFile: type.icon
    }));
    fs.writeFileSync(
      plistPath,
      plist.build(plistData)
    );
  }

  if (electronPlatformName === "linux") {
    console.log("Linux document icons are handled by desktop MIME integration.");
  }
  
  if (electronPlatformName === "win32") {
    console.log("Windows uses ICO fileAssociations.");
  }
}