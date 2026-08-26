!include WinVer.nsh
!include LogicLib.nsh

!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Welcome to StoreListen"
  !define MUI_WELCOMEPAGE_TEXT "This installer sets up the StoreListen desktop recorder.$\r$\n$\r$\nThe app talks to your StoreListen API for uploads and AI analysis. Gemini keys stay on the server.$\r$\n$\r$\nClick Next to continue."
!macroend

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "StoreListen requires Windows 10 or later (64-bit)."
    Abort
  ${EndIf}
  ; Close a previous copy so files can be replaced (no-op if not running).
  nsExec::Exec 'taskkill /F /IM StoreListen.exe /T'
!macroend

!macro customInstall
  WriteRegStr HKLM "Software\OnyxTech\StoreListen" "InstallDir" "$INSTDIR"
!macroend

!macro customUnInstall
  DeleteRegKey HKLM "Software\OnyxTech\StoreListen"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StoreListen"
!macroend
