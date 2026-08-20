param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

$backendDir = $PSScriptRoot
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$requirements = Join-Path $backendDir "requirements.txt"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }
}

# Keep staging seeding isolated from the user's global Python installation.
# On the first run this creates backend/.venv and installs the checked-in
# backend requirements. Later runs reuse the same environment and only repair
# it if required runtime imports are missing.
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating isolated backend Python environment (.venv)..."
    Invoke-Checked -Executable "python" -Arguments @("-m", "venv", $venvDir) -FailureMessage "Could not create backend .venv"

    Write-Host "Installing backend dependencies..."
    Invoke-Checked -Executable $venvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip") -FailureMessage "Could not upgrade pip in backend .venv"
    Invoke-Checked -Executable $venvPython -Arguments @("-m", "pip", "install", "-r", $requirements) -FailureMessage "Could not install backend requirements"
}
else {
    & $venvPython -c "import django, rest_framework, corsheaders, psycopg, storages"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend .venv is missing required packages; repairing dependencies..."
        Invoke-Checked -Executable $venvPython -Arguments @("-m", "pip", "install", "-r", $requirements) -FailureMessage "Could not repair backend requirements"
    }
}

$securePassword = Read-Host "Supabase database password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $encodedPassword = [System.Uri]::EscapeDataString($plainPassword)
    $env:DATABASE_URL = "postgresql://postgres.nhxcuormtcnnauhhjedm:$encodedPassword@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

    $commandArgs = @("manage.py", "seed_demo", "--settings=config.settings.production")
    if ($Reset) {
        $commandArgs += "--reset"
    }

    Invoke-Checked -Executable $venvPython -Arguments $commandArgs -FailureMessage "Pearlix demo seeding failed"
    Invoke-Checked -Executable $venvPython -Arguments @("manage.py", "finalize_demo_seed", "--settings=config.settings.production") -FailureMessage "Pearlix demo finalization/audit failed"
}
finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    $plainPassword = $null
    $encodedPassword = $null
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
