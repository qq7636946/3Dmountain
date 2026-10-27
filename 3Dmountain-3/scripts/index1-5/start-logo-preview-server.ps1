$ErrorActionPreference = 'Stop'
try {
  $taskExisting = Invoke-RestMethod -Uri 'http://127.0.0.1:8789/status' -TimeoutSec 1
  if ($taskExisting.ready -and $taskExisting.memoryOnly) { Write-Output '快速預覽服務已啟動。'; exit 0 }
} catch { }
$taskPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$taskPreviewScript = Join-Path $PSScriptRoot 'logo-preview-server.py'
$taskLogs = Join-Path $env:LOCALAPPDATA 'FinnovationLogoModel'
New-Item -ItemType Directory -Force -Path $taskLogs | Out-Null
Start-Process -FilePath $taskPython -ArgumentList @('-u', ('"' + $taskPreviewScript + '"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'preview.stdout.log') -RedirectStandardError (Join-Path $taskLogs 'preview.stderr.log') | Out-Null
for ($taskAttempt=0; $taskAttempt -lt 28; $taskAttempt++) {
  Start-Sleep -Milliseconds 250
  try {
    $taskStatus = Invoke-RestMethod -Uri 'http://127.0.0.1:8789/status' -TimeoutSec 1
    if ($taskStatus.ready -and $taskStatus.memoryOnly) { Write-Output '快速預覽：http://127.0.0.1:8789'; exit 0 }
  } catch { }
}
throw ('快速預覽未就緒，請查看 ' + $taskLogs)
