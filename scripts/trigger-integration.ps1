$ErrorActionPreference = 'Stop'

# Create session
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Login payload
$loginBody = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json

# Login request
Write-Host 'Logging in as admin...'
$loginResp = Invoke-WebRequest -Uri 'http://localhost:5201/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody -WebSession $session
Write-Host ('Login status: ' + $loginResp.StatusCode)

# Trigger integration fetch
$fetchBody = @{ sync_type = 'full' } | ConvertTo-Json
Write-Host 'Triggering ERP supplier integration fetch...'
$fetchResp = Invoke-WebRequest -Uri 'http://localhost:5201/api/erp-integration/suppliers/fetch' -Method POST -ContentType 'application/json' -Body $fetchBody -WebSession $session
Write-Host ('Fetch status: ' + $fetchResp.StatusCode)
Write-Host 'Fetch response:'
$fetchResp.Content