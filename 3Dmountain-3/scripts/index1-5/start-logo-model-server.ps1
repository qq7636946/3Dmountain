$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$serviceScript = Join-Path $PSScriptRoot 'logo-model-server.py'
$blenderBinary = 'C:\Program Files\Blender Foundation\Blender 4.3\blender.exe'
& (Join-Path $PSScriptRoot 'start-logo-preview-server.ps1')
try {
  $existing = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/status' -TimeoutSec 2
  if ($existing.ready -and $existing.blender) { Write-Output 'Blender 建模服務已啟動。'; exit 0 }
} catch { }
if (-not (Test-Path -LiteralPath $blenderBinary -PathType Leaf)) { throw '找不到 Blender 4.3，請更新啟動器的 blenderBinary 路徑。' }
$logFolder = Join-Path $workspaceRoot '.qa/logo-model-controls-20261025'
New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
$arguments = @('--background', '--factory-startup', '--python', ('"' + $serviceScript + '"'))
Start-Process -FilePath $blenderBinary -ArgumentList $arguments -WorkingDirectory $workspaceRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logFolder 'service.stdout.log') -RedirectStandardError (Join-Path $logFolder 'service.stderr.log') | Out-Null
for ($attempt = 0; $attempt -lt 32; $attempt++) {
  Start-Sleep -Milliseconds 250
  try {
    $status = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/status' -TimeoutSec 1
    if ($status.ready -and $status.blender) { Write-Output 'Blender 建模服務：http://127.0.0.1:8788'; exit 0 }
  } catch { }
}
throw ('Blender 服務未在預期時間內啟動，請查看 ' + $logFolder)
