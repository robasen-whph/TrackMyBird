<# OpenSky-Live.ps1
Simple PowerShell client for OpenSky OAuth2 + live state polling.

Usage:
  # set once
  $env:OS_CLIENT_ID="nycrobaviation-api-client"
  $env:OS_CLIENT_SECRET="<your_client_secret>"

  # one-shot fetch
  .\OpenSky-Live.ps1 -Hex 4bb14a

  # watch loop (Ctrl+C to stop)
  .\OpenSky-Live.ps1 -Hex 4bb14a -Watch -IntervalSec 2
#>

param(
  [Parameter(Mandatory=$true)][string]$Hex,
  [switch]$Watch,
  [int]$IntervalSec = 3
)

# ---- config
$ClientId     = "nycrobaviation-api-client"
$ClientSecret = "FwwMtVdibhXWnUSecaPGJj1r4xSi2MIQ"
$TokenUrl     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"


# ---- token cache
$script:OsToken = $null
$script:OsExp = Get-Date 0

function Get-OsToken {
  if ($script:OsToken -and (Get-Date) -lt $script:OsExp.AddSeconds(-60)) {
    return $script:OsToken
  }
  $body = "grant_type=client_credentials&client_id=$ClientId&client_secret=$ClientSecret"
  $resp = Invoke-RestMethod -Method POST -Uri $TokenUrl -ContentType "application/x-www-form-urlencoded" -Body $body
  $script:OsToken = $resp.access_token
  $script:OsExp = (Get-Date).AddSeconds([int]($resp.expires_in))
  return $script:OsToken
}

function Get-OpenSkyState([string]$hex) {
  try {
    # normalize: remove spaces, lowercase
    $hex = ($hex ?? "").Trim().ToLower()
    if (-not $hex -or $hex -notmatch '^[0-9a-f]{6}$') {
      Write-Host "Invalid HEX format: $hex"
      return $null
    }

    $tok = Get-OsToken
    $hdr = @{ Authorization = "Bearer $tok" }
    $url = "https://opensky-network.org/api/states/all?icao24=$hex"

    $j = Invoke-RestMethod -Headers $hdr -Uri $url -Method GET
    if (-not $j.states -or $j.states.Count -eq 0) {
      Write-Host ("{0:HH:mm:ss}  no data for {1}" -f (Get-Date), $hex)
      return $null
    }

    $s = $j.states[0]
    [pscustomobject]@{
      time          = Get-Date ([DateTimeOffset]::FromUnixTimeSeconds($j.time)).UtcDateTime
      hex           = $s[0]
      callsign      = ($s[1] -as [string]).Trim()
      originCountry = $s[2]
      lat           = [double]$s[6]
      lon           = [double]$s[5]
      baroAlt_m     = $s[7]
      onGround      = [bool]$s[8]
      gs_mps        = $s[9]
      gs_kt         = if ($s[9]) { [math]::Round($s[9]*1.94384,0) } else { $null }
      track_deg     = $s[10]
      lastContact   = Get-Date ([DateTimeOffset]::FromUnixTimeSeconds($s[4])).UtcDateTime
    }
  }
  catch {
    Write-Host ("{0:HH:mm:ss}  error: {1}" -f (Get-Date), $_.Exception.Message)
    return $null
  }
}


if ($Watch) {
  while ($true) {
    try {
      $o = Get-OpenSkyState $Hex
      if ($null -eq $o) {
        Write-Host ("{0:HH:mm:ss}  no data" -f (Get-Date))
      } else {
        Write-Host ("{0:HH:mm:ss}  {1}  lat {2:N4}  lon {3:N4}  GS {4} kt  trk {5}" -f `
          (Get-Date), $o.callsign, $o.lat, $o.lon, $o.gs_kt, $o.track_deg)
      }
    } catch {
      Write-Host ("{0:HH:mm:ss}  error: {1}" -f (Get-Date), $_.Exception.Message)
    }
    Start-Sleep -Seconds $IntervalSec
  }
} else {
  $o = Get-OpenSkyState $Hex
  if ($null -eq $o) { Write-Error "No data"; exit 2 }
  $o | Format-List
}
