[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ScriptArgs
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HrnxExe = Join-Path $ScriptDir "hrnx-core\.venv\Scripts\hrnx.exe"

if (-not (Test-Path $HrnxExe)) {
    Write-Error "Cannot locate hrnx.exe at $HrnxExe. Please check hrnx-core/.venv."
    exit 1
}

& $HrnxExe @ScriptArgs
