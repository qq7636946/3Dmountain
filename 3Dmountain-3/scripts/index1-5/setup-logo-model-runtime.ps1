$ErrorActionPreference = 'Stop'
$taskPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$taskDependencies = Join-Path $env:LOCALAPPDATA 'FinnovationLogoModel/python-deps'
if (!(Test-Path -LiteralPath $taskPython -PathType Leaf)) { throw '找不到本機 Python 執行環境。' }
& $taskPython -m pip install --target $taskDependencies 'scikit-image==0.26.0' 'shapely==2.2.0' --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw '圓角建模套件安裝失敗。' }
Write-Output ('圓角建模執行環境已安裝：' + $taskDependencies)
