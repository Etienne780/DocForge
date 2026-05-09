Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

Name "DocForge"
OutFile "${PROJECT_DIR}\dist\${PRODUCT_NAME}-Setup-${VERSION}.exe"

InstallDir "$LOCALAPPDATA\Programs\DocForge"
InstallDirRegKey HKCU "Software\com.Etienne780.DocForge" "InstallDir"
RequestExecutionLevel user

; --- Modern UI Configuration ---
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Are you sure you want to quit the DocForge installation?"
!define MUI_ABORTWARNING_TITLE "Exit Setup"

; Welcome page configuration
!define MUI_WELCOMEPAGE_TITLE "Welcome to DocForge Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of DocForge.$\r$\n$\r$\nClick Next to continue."

; Finish page configuration
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "DocForge has been successfully installed.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\DocForge.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch DocForge"
!define MUI_FINISHPAGE_RUN_PARAMETERS ""
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

; --- Page order (important: each page only once) ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Custom function is applied only to the finish page below
!define MUI_PAGE_CUSTOMFUNCTION_SHOW FinishPageShow
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --- Languages ---
!insertmacro MUI_LANGUAGE "English"

; --- Installer sections ---
Section "Install" SEC01
  SetOutPath "$INSTDIR"

  !ifdef APP_64
    File /oname=app-x64.7z "${APP_64}"
    Nsis7z::Extract "$INSTDIR\app-x64.7z"
    Delete "$INSTDIR\app-x64.7z"
  !endif

  WriteUninstaller "$INSTDIR\Uninstall DocForge.exe"

  WriteRegStr HKCU "Software\com.Etienne780.DocForge" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.Etienne780.DocForge" "DisplayName" "DocForge"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.Etienne780.DocForge" "UninstallString" "$INSTDIR\Uninstall DocForge.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.Etienne780.DocForge" "DisplayVersion" "1.3.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.Etienne780.DocForge" "Publisher" "Etienne780"

  CreateShortcut "$DESKTOP\DocForge.lnk" "$INSTDIR\DocForge.exe"
  CreateDirectory "$SMPROGRAMS\DocForge"
  CreateShortcut "$SMPROGRAMS\DocForge\DocForge.lnk" "$INSTDIR\DocForge.exe"
SectionEnd

Section "Uninstall" SEC02
  Delete "$INSTDIR\Uninstall DocForge.exe"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\DocForge.lnk"
  RMDir /r "$SMPROGRAMS\DocForge"
  DeleteRegKey HKCU "Software\com.Etienne780.DocForge"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.Etienne780.DocForge"
SectionEnd

; --- Functions ---
Function .onInstSuccess
  BringToFront
FunctionEnd

Function FinishPageShow
  ; Retrieve the Finish button (ID 1) from the parent window
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Finish"
FunctionEnd