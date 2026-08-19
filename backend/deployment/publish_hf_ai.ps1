param(
    [Parameter(Mandatory = $true)]
    [string]$Bundle
)

$ErrorActionPreference = "Stop"
$backendDir = Split-Path -Parent $PSScriptRoot
$venvDir = Join-Path $backendDir ".hf-deploy-venv"
$python = Join-Path $venvDir "Scripts\python.exe"
$hf = Join-Path $venvDir "Scripts\hf.exe"

if (-not (Test-Path $python)) {
    Write-Host "Creating isolated Hugging Face deployment environment..."
    python -m venv $venvDir
    if ($LASTEXITCODE -ne 0) { throw "Could not create .hf-deploy-venv." }
    & $python -m pip install --upgrade pip "huggingface_hub>=1.3,<2"
    if ($LASTEXITCODE -ne 0) { throw "Could not install huggingface_hub." }
}

Write-Host "Authenticating with Hugging Face in your browser..."
& $hf auth login
if ($LASTEXITCODE -ne 0) { throw "Hugging Face login failed." }

& $python (Join-Path $PSScriptRoot "publish_hf_ai.py") --bundle $Bundle
if ($LASTEXITCODE -ne 0) { throw "Pearlix Hugging Face publication failed." }
