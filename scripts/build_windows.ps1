[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$liveGamerRoot = Split-Path -Parent $PSScriptRoot
$liveGamerPython = Join-Path $liveGamerRoot '.venv\Scripts\python.exe'
$liveGamerFfmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$liveGamerStatic = Join-Path $liveGamerRoot 'app\static'
$liveGamerCharacters = Join-Path $liveGamerRoot 'kenney_blocky-characters_20\Models\GLB format'
$liveGamerIcon = Join-Path $liveGamerRoot 'assets\live-gamer-3d-icon.ico'
$liveGamerOutput = Join-Path $liveGamerRoot 'output'
$liveGamerBuild = Join-Path $env:TEMP 'live-gamer-3d-desktop-pyinstaller'

if (-not (Test-Path -LiteralPath $liveGamerPython)) {
    throw "Ambiente Python não encontrado em $liveGamerPython. Crie .venv e instale requirements.txt primeiro."
}

& $liveGamerPython -m PyInstaller `
    --noconfirm `
    --onefile `
    --noconsole `
    --name LiveGamer3D `
    --icon $liveGamerIcon `
    --distpath $liveGamerOutput `
    --workpath $liveGamerBuild `
    --specpath $liveGamerBuild `
    --collect-all webview `
    --hidden-import webview.platforms.edgechromium `
    --add-data "$liveGamerStatic;app\static" `
    --add-data "$liveGamerCharacters;kenney_blocky-characters_20\Models\GLB format" `
    --add-binary "$liveGamerFfmpeg;." `
    (Join-Path $liveGamerRoot 'app\desktop.py')

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Get-Item -LiteralPath (Join-Path $liveGamerOutput 'LiveGamer3D.exe') | Select-Object FullName, Length, LastWriteTime
