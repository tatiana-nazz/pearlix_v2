param(
    [Parameter(Mandatory = $true)]
    [string]$Bundle,
    [int]$Port = 7860
)

$ErrorActionPreference = "Stop"
$backendDir = Split-Path -Parent $PSScriptRoot
$venvDir = Join-Path $backendDir ".local-ai-venv"
$python = Join-Path $venvDir "Scripts\python.exe"
$modelRoot = Join-Path $backendDir ".local-ai-models"
$tokenFile = Join-Path $backendDir ".local-ai-token"

if (-not (Test-Path $python)) {
    Write-Host "Creating isolated local AI environment..."
    python -m venv $venvDir
    if ($LASTEXITCODE -ne 0) { throw "Could not create .local-ai-venv." }
}

Write-Host "Installing/verifying local AI runtime dependencies..."
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Could not update pip." }
& $python -m pip install -r (Join-Path $backendDir "requirements-ai-service.txt")
if ($LASTEXITCODE -ne 0) { throw "Could not install the local AI runtime." }

Write-Host "Preparing the locked model bundle..."
& $python (Join-Path $PSScriptRoot "prepare_local_ai.py") --bundle $Bundle --output $modelRoot
if ($LASTEXITCODE -ne 0) { throw "Could not prepare the locked model bundle." }

if (Test-Path $tokenFile) {
    $serviceToken = (Get-Content $tokenFile -Raw).Trim()
}
else {
    $serviceToken = (& $python -c "import secrets; print(secrets.token_urlsafe(48))").Trim()
    Set-Content -Path $tokenFile -Value $serviceToken -NoNewline
}
if (-not $serviceToken) { throw "Could not create the local AI bearer token." }

$env:PEARLIX_LOCAL_AI_MODEL_ROOT = $modelRoot
$env:PEARLIX_LOCAL_AI_TOKEN = $serviceToken
$env:PEARLIX_LOCAL_AI_DEVICE = "cpu"

Write-Host ""
Write-Host "Pearlix local AI is starting on http://127.0.0.1:$Port"
Write-Host "Keep this terminal open."
Write-Host ""
Write-Host "AI_SERVICE_TOKEN (keep private; use this exact value in Vercel):"
Write-Host $serviceToken
Write-Host ""
Write-Host "After /health is ready, open a SECOND PowerShell window and run:"
Write-Host "  cloudflared tunnel --url http://127.0.0.1:$Port"
Write-Host "Then use the generated https://...trycloudflare.com URL as AI_SERVICE_URL in Vercel."
Write-Host ""

& $python -m uvicorn local_ai_service:app --app-dir $PSScriptRoot --host 127.0.0.1 --port $Port
