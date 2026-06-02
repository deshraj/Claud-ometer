# Start Claud-ometer as a background process (production mode)
# Usage: .\scripts\start-bg.ps1 [stop|status|restart]

$AppName = "Claud-ometer"
$PidFile = Join-Path $PSScriptRoot ".claud-ometer.pid"
$LogFile = Join-Path $PSScriptRoot ".claud-ometer.log"
$ProjectRoot = Split-Path $PSScriptRoot

function Get-RunningProcess {
    if (Test-Path $PidFile) {
        $savedPid = (Get-Content $PidFile).Trim()
        if ($savedPid) {
            try { return Get-Process -Id $savedPid -ErrorAction Stop } catch { return $null }
        }
    }
    return $null
}

function Start-App {
    $existing = Get-RunningProcess
    if ($existing) {
        Write-Host "$AppName is already running (PID: $($existing.Id))" -ForegroundColor Yellow
        return
    }

    Write-Host "Building $AppName..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    & npm run build 2>&1 | Out-Null

    Write-Host "Starting $AppName in background..." -ForegroundColor Cyan
    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm start" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $LogFile `
        -RedirectStandardError "$LogFile.err" `
        -PassThru

    $proc.Id | Out-File $PidFile -Encoding utf8
    Pop-Location

    Start-Sleep -Seconds 3
    Write-Host "$AppName started (PID: $($proc.Id)) on http://localhost:3000" -ForegroundColor Green
}

function Stop-App {
    $proc = Get-RunningProcess
    if ($proc) {
        # Kill the cmd process and its child node process
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id }
        foreach ($child in $children) {
            try { Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
        }
        try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        Write-Host "$AppName stopped" -ForegroundColor Green
    } else {
        Write-Host "$AppName is not running" -ForegroundColor Yellow
        if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    }
}

function Get-Status {
    $proc = Get-RunningProcess
    if ($proc) {
        Write-Host "$AppName is running (PID: $($proc.Id))" -ForegroundColor Green
    } else {
        Write-Host "$AppName is not running" -ForegroundColor Yellow
        if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    }
}

$action = if ($args.Count -gt 0) { $args[0] } else { "start" }

switch ($action) {
    "stop"    { Stop-App }
    "status"  { Get-Status }
    "restart" { Stop-App; Start-Sleep -Seconds 2; Start-App }
    default   { Start-App }
}
