param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $ProjectRoot

function Exit-With-Pause {
  param(
    [int]$Code,
    [string]$Message
  )

  if ($Message) {
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
  }
  Write-Host ""
  Write-Host "Press Enter to close this window..."
  [void](Read-Host)
  exit $Code
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = $null
  try {
    $address = [System.Net.IPAddress]::Parse("127.0.0.1")
    $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) {
      $listener.Stop()
    }
  }
}

function Get-FreePort {
  param(
    [int]$Preferred,
    [int]$Attempts = 20
  )

  for ($port = $Preferred; $port -lt ($Preferred + $Attempts); $port++) {
    if (Test-PortAvailable -Port $port) {
      return $port
    }
  }

  throw "No free port found near $Preferred"
}

function Quote-PowerShellLiteral {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

try {
  $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue

  if ($null -eq $nodeCommand -or $null -eq $npmCommand) {
    Exit-With-Pause 1 "Node.js and npm were not found. Install Node.js 22 LTS or newer, then run this file again."
  }

  $nodeVersion = (& $nodeCommand.Source -v).Trim()
  $majorVersion = [int](($nodeVersion -replace "^v", "").Split(".")[0])
  if ($majorVersion -lt 22) {
    Exit-With-Pause 1 "Found $nodeVersion. This project needs Node.js 22 or newer because backend uses node:sqlite."
  }

  Write-Host "Sivka-Burka local launcher" -ForegroundColor Green
  Write-Host "Project: $ProjectRoot"
  Write-Host "Node: $nodeVersion"
  Write-Host ""

  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-Host "node_modules not found. Installing dependencies..."
    & $npmCommand.Source install
    if ($LASTEXITCODE -ne 0) {
      Exit-With-Pause 1 "npm install failed."
    }
    Write-Host ""
  } else {
    Write-Host "Dependencies are already installed."
  }

  $backendPort = Get-FreePort -Preferred 8090
  $frontendPort = Get-FreePort -Preferred 5174
  $apiBaseUrl = "http://127.0.0.1:$backendPort/api"
  $frontendUrl = "http://127.0.0.1:$frontendPort/"

  $envLocalPath = Join-Path $ProjectRoot ".env.local"
  $envLocalContent = @(
    "VITE_API_BASE_URL=$apiBaseUrl"
  ) -join [Environment]::NewLine
  Set-Content -LiteralPath $envLocalPath -Value ($envLocalContent + [Environment]::NewLine) -Encoding UTF8

  $rootLiteral = Quote-PowerShellLiteral $ProjectRoot
  $npmLiteral = Quote-PowerShellLiteral $npmCommand.Source

  $backendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Sivka-Burka Backend';
Set-Location -LiteralPath $rootLiteral;
`$env:BACKEND_HOST = '127.0.0.1';
`$env:BACKEND_PORT = '$backendPort';
& $npmLiteral run backend:dev;
"@

  $frontendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Sivka-Burka Frontend';
Set-Location -LiteralPath $rootLiteral;
`$env:VITE_API_BASE_URL = '$apiBaseUrl';
& $npmLiteral run dev -- --host 127.0.0.1 --port $frontendPort;
"@

  Write-Host "Starting backend on $apiBaseUrl"
  Start-Process -FilePath "powershell.exe" -WorkingDirectory $ProjectRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $backendCommand
  )

  Write-Host "Starting frontend on $frontendUrl"
  Start-Process -FilePath "powershell.exe" -WorkingDirectory $ProjectRoot -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $frontendCommand
  )

  Write-Host ""
  Write-Host "Local app is starting..." -ForegroundColor Green
  Write-Host "Frontend: $frontendUrl"
  Write-Host "Backend:  $apiBaseUrl"
  Write-Host ""
  Write-Host "Keep the Backend and Frontend windows open while using the app."
  Write-Host "Close those two windows to stop the local app."

  if (-not $NoBrowser) {
    Start-Sleep -Seconds 4
    Start-Process $frontendUrl
  }
} catch {
  Exit-With-Pause 1 $_.Exception.Message
}
