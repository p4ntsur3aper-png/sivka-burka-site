$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$archivePath = Join-Path (Split-Path $projectRoot -Parent) 'sivka-burka-github.zip'

$excludedDirs = @(
  'node_modules',
  'dist',
  '.npm-cache',
  'docx_render_backend',
  'diploma_work'
)

$excludedPaths = @(
  'backend/.data',
  'tools/__pycache__'
)

$excludedFiles = @(
  '.env',
  '.env.local'
)

$excludedExtensions = @(
  '.log',
  '.rar',
  '.zip',
  '.7z',
  '.docx',
  '.pdf',
  '.tmp',
  '.bak'
)

function Get-RelativePath {
  param([string]$FullPath)
  return $FullPath.Substring($projectRoot.Length).TrimStart('\') -replace '\\', '/'
}

function Test-IsExcluded {
  param([System.IO.FileInfo]$File)

  $relativePath = Get-RelativePath $File.FullName
  $pathParts = $relativePath -split '/'
  $fileName = $File.Name
  $extension = $File.Extension.ToLowerInvariant()

  if ($excludedFiles -contains $fileName) {
    return $true
  }

  if ($excludedExtensions -contains $extension) {
    return $true
  }

  if ($relativePath -notlike '*/*' -and $extension -eq '.png') {
    return $true
  }

  foreach ($dir in $excludedDirs) {
    if ($pathParts -contains $dir) {
      return $true
    }
  }

  foreach ($path in $excludedPaths) {
    if ($relativePath -eq $path -or $relativePath.StartsWith("$path/")) {
      return $true
    }
  }

  return $false
}

if (Test-Path $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($archivePath, 'Create')

try {
  Get-ChildItem -Path $projectRoot -Recurse -File -Force |
    Where-Object { -not (Test-IsExcluded $_) } |
    Sort-Object FullName |
    ForEach-Object {
      $entryPath = Get-RelativePath $_.FullName
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $_.FullName,
        $entryPath,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
}
finally {
  $zip.Dispose()
}

Write-Host "Archive created: $archivePath"
