# Generate a development Authenticode certificate (not for public release).
# Production: buy an OV/EV code signing cert and set CSC_LINK / CSC_KEY_PASSWORD.

$ErrorActionPreference = "Stop"
$outDir = Join-Path $PSScriptRoot "..\certs"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$pfx = Join-Path $outDir "storelisten-dev.pfx"
$passwordPlain = "dev-only-change-me"
$password = ConvertTo-SecureString -String $passwordPlain -Force -AsPlainText

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=OnyxTech StoreListen Dev" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(2)

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $password | Out-Null

Write-Host "Created $pfx"
Write-Host "For a local signed build:"
Write-Host "  `$env:CSC_LINK = `"$pfx`""
Write-Host "  `$env:CSC_KEY_PASSWORD = `"$passwordPlain`""
Write-Host "  `$env:WIN_CSC_LINK = `$env:CSC_LINK"
Write-Host "  `$env:WIN_CSC_KEY_PASSWORD = `$env:CSC_KEY_PASSWORD"
Write-Host "Trust this cert only on machines you control. Public SmartScreen still warns until you use a purchased certificate."
