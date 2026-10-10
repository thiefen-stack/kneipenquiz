# Kneipenquiz v0.6 – Update für das bestehende GitHub-Desktop-Projekt.
# Dieses Skript verändert nur index.html, app.js, styles.css, service-worker.js
# und legt config.js sowie profiles.js neu an. Die Fragenbank bleibt unverändert.
$ErrorActionPreference = 'Stop'
try {
    $repo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $patchFile = Join-Path $PSScriptRoot 'patches.json'
    $patches = Get-Content -LiteralPath $patchFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $targetNames = @('index.html', 'app.js', 'styles.css', 'service-worker.js')
    $changes = @{}
    foreach ($name in $targetNames) {
        $path = Join-Path $repo $name
        if (-not (Test-Path -LiteralPath $path)) { throw "Datei fehlt: $path. Bitte im richtigen GitHub-Repo entpacken." }
        $source = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        if ($source.Contains('KNEIPENQUIZ_V06')) {
            Write-Host "Bereits aktualisiert: $name" -ForegroundColor Yellow
            continue
        }
        $result = $source
        foreach ($patch in $patches.$name) {
            $find = [string]$patch.find
            $replace = [string]$patch.replace
            $first = $result.IndexOf($find, [System.StringComparison]::Ordinal)
            if ($first -lt 0) { throw "Version stimmt nicht: Suchtext in $name fehlt. Es wurden keine Dateien veraendert." }
            $second = $result.IndexOf($find, $first + $find.Length, [System.StringComparison]::Ordinal)
            if ($second -ge 0) { throw "Mehrdeutige Aenderung in $name. Es wurden keine Dateien veraendert." }
            $result = $result.Replace($find, $replace)
        }
        $changes[$name] = $result
    }
    if ($changes.Count -gt 0) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = Join-Path $env:TEMP ("kneipenquiz-v05-backup-" + $stamp)
        New-Item -ItemType Directory -Path $backup -Force | Out-Null
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        foreach ($name in $changes.Keys) {
            $path = Join-Path $repo $name
            Copy-Item -LiteralPath $path -Destination (Join-Path $backup $name)
        }
        foreach ($name in $changes.Keys) {
            [System.IO.File]::WriteAllText((Join-Path $repo $name), [string]$changes[$name], $utf8)
            Write-Host "Aktualisiert: $name" -ForegroundColor Green
        }
        Write-Host "Sicherung der alten Dateien: $backup" -ForegroundColor DarkGray
    }
    foreach ($name in @('profiles.js', 'config.js')) {
        $source = Join-Path $PSScriptRoot $name
        $dest = Join-Path $repo $name
        if (-not (Test-Path -LiteralPath $dest)) {
            Copy-Item -LiteralPath $source -Destination $dest
            Write-Host "Neu angelegt: $name" -ForegroundColor Green
        } else {
            Write-Host "Bereits vorhanden, nicht ueberschrieben: $name" -ForegroundColor Yellow
        }
    }
    Write-Host "`nKneipenquiz 0.6 installiert. Nun config.js bearbeiten und in GitHub Desktop committen/pushen." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "`nUPDATE ABGEBROCHEN: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
