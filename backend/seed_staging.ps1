param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

$securePassword = Read-Host "Supabase database password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $encodedPassword = [System.Uri]::EscapeDataString($plainPassword)
    $env:DATABASE_URL = "postgresql://postgres.nhxcuormtcnnauhhjedm:$encodedPassword@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

    $commandArgs = @("manage.py", "seed_demo")
    if ($Reset) {
        $commandArgs += "--reset"
    }

    python @commandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Pearlix demo seeding failed with exit code $LASTEXITCODE."
    }
}
finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    $plainPassword = $null
    $encodedPassword = $null
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
