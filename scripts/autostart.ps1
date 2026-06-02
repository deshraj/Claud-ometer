# Run by Task Scheduler at logon — starts Claud-ometer silently
Start-Sleep -Seconds 15

$ProjectRoot = "X:\Software\Claud-ometer"
$PidFile = "$ProjectRoot\scripts\.claud-ometer.pid"
$LogFile = "$ProjectRoot\scripts\.claud-ometer.log"

if (Test-Path $PidFile) {
    $oldPid = (Get-Content $PidFile).Trim()
    if ($oldPid) {
        try { Stop-Process -Id $oldPid -Force -ErrorAction Stop } catch {}
    }
    Remove-Item $PidFile -Force
}

$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm start" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError "$LogFile.err" `
    -PassThru

$proc.Id | Out-File $PidFile -Encoding utf8
