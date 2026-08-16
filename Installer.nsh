; --- Welcome-Seite manuell aktivieren (ist standardmäßig NICHT enthalten) ---
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to DocForge Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of DocForge.$\r$\n$\r$\nClick Next to continue."
  !insertMacro MUI_PAGE_WELCOME
!macroend

; --- Install-Mode-Seite überspringen: immer per-user, wie vorher ---
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; --- Finish-Button-Text (Ersatz für deinen SendMessage-Hack) ---
!macro customHeader
  !define MUI_FINISHPAGE_BUTTONTEXT "Finish"
!macroend

!macro customInstall
!macroend

!macro customUnInstall
!macroend