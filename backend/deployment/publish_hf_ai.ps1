param(
    [Parameter(Mandatory = $true)]
    [string]$Bundle,
    [switch]$LegacyUpload
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

$previousDisableXet = $env:HF_HUB_DISABLE_XET
try {
    $publishArgs = @((Join-Path $PSScriptRoot "publish_hf_ai.py"), "--bundle", $Bundle)
    if ($LegacyUpload) {
        Write-Host "Compatibility upload mode enabled: hf-xet is disabled and files will upload one at a time over the legacy HTTP path."
        $env:HF_HUB_DISABLE_XET = "1"
        $publishArgs += "--legacy-upload"
    }

    & $python @publishArgs
    if ($LASTEXITCODE -ne 0) { throw "Pearlix Hugging Face publication failed." }
}
finally {
    if ($null -eq $previousDisableXet) {
        Remove-Item Env:HF_HUB_DISABLE_XET -ErrorAction SilentlyContinue
    }
    else {
        $env:HF_HUB_DISABLE_XET = $previousDisableXet
    }
}
