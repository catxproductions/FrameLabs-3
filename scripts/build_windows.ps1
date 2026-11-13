param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildDirectory = Join-Path $repoRoot "build"

Write-Host "Configuring FrameLabs 3 ($Configuration, x64)..." -ForegroundColor Cyan
cmake -S $repoRoot -B $buildDirectory -A x64 -DCMAKE_BUILD_TYPE=$Configuration
if ($LASTEXITCODE -ne 0) {
    throw "CMake configuration failed with exit code $LASTEXITCODE."
}

Write-Host "Building FrameLabs 3..." -ForegroundColor Cyan
cmake --build $buildDirectory --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) {
    throw "Native build failed with exit code $LASTEXITCODE."
}

$executable = Join-Path $buildDirectory "bin/FrameLabs3.exe"
if (-not (Test-Path $executable)) {
    throw "The build completed but the expected executable was not found at $executable."
}

Write-Host ""
Write-Host "Build succeeded." -ForegroundColor Green
Write-Host "Executable: $executable" -ForegroundColor Green
Get-Item $executable | Select-Object FullName, Length, LastWriteTime
