param(
  [string]$Mode = 'start'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Show-Usage {
  @'
usage: powershell -ExecutionPolicy Bypass -File ./script/build_and_run.ps1 [mode]

Modes:
  start, run        Start the Expo dev server
  android           Start Expo and open Android
  ios               Start Expo and open iOS
  web               Start Expo for web
  dev-client        Start Expo in development-client mode
  tunnel            Start Expo using tunnel transport
  doctor            Run Expo diagnostics
  help              Show this help
'@
}

switch ($Mode) {
  { $_ -in 'start', 'run' } {
    & npx.cmd expo start
    break
  }
  'android' {
    & npx.cmd expo start --android
    break
  }
  'ios' {
    & npx.cmd expo start --ios
    break
  }
  'web' {
    & npx.cmd expo start --web
    break
  }
  'dev-client' {
    & npx.cmd expo start --dev-client
    break
  }
  'tunnel' {
    & npx.cmd expo start --tunnel
    break
  }
  'doctor' {
    & npx.cmd expo-doctor
    break
  }
  { $_ -in 'help', '--help' } {
    Show-Usage
    break
  }
  default {
    Show-Usage
    exit 2
  }
}

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
