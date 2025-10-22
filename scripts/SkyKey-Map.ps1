param(
  [Parameter(Mandatory=$true)][string]$Hex,
  [string]$Out = ".\SkyMap.html"
)

# --- config
$ClientId     = "nycrobaviation-api-client"
$ClientSecret = "FwwMtVdibhXWnUSecaPGJj1r4xSi2MIQ"
$TokenUrl     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
$Inv = [System.Globalization.CultureInfo]::InvariantCulture

function Get-OsToken {
  $body = "grant_type=client_credentials&client_id=$ClientId&client_secret=$ClientSecret"
  (Invoke-RestMethod -Method POST -Uri $TokenUrl -ContentType "application/x-www-form-urlencoded" -Body $body).access_token
}

function Get-OpenSkyState([string]$hex) {
  $hex = ($hex ?? "").ToLower()
  if ($hex -notmatch '^[0-9a-f]{6}$') { return $null }
  $tok = Get-OsToken
  $hdr = @{ Authorization = "Bearer $tok" }
  $url = "https://opensky-network.org/api/states/all?icao24=$hex"
  $j = Invoke-RestMethod -Headers $hdr -Uri $url -Method GET
  if (-not $j.states -or $j.states.Count -eq 0) { return $null }
  $s = $j.states[0]
  [pscustomobject]@{
    time      = [DateTimeOffset]::FromUnixTimeSeconds($j.time).UtcDateTime
    hex       = $s[0]
    callsign  = ($s[1] -as [string]).Trim()
    lat       = [double]$s[6]
    lon       = [double]$s[5]
    alt_m     = $s[7]
    gs_kt     = if ($s[9]) { [math]::Round($s[9]*1.94384,0) } else { $null }
    track_deg = $s[10]
  }
}

$o = Get-OpenSkyState $Hex
if ($null -eq $o -or -not $o.lat -or -not $o.lon) { Write-Error "No lat/lon data for HEX '$Hex'"; exit 2 }

# pre-format numbers as plain dot-decimal
$LAT = [string]::Format($Inv, "{0}", $o.lat)
$LON = [string]::Format($Inv, "{0}", $o.lon)
$ALT = [string]::Format($Inv, "{0}", [int]$o.alt_m)
$GS  = [string]::Format($Inv, "{0}", ($o.gs_kt ?? 0))
$CS  = if ($o.callsign) { $o.callsign } else { $o.hex }
$TS  = $o.time.ToString("u")

$popup = "$CS • $GS kt • $ALT m • $TS"
$popupJson = (ConvertTo-Json $popup)

$html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Sky-Key Live • $CS</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>html,body,#map{height:100%;margin:0}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const lat = $LAT;
    const lon = $LON;
    const popup = $popupJson;
    const map = L.map('map').setView([lat, lon], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup(popup).openPopup();
    L.circle([lat, lon], {radius: 1000}).addTo(map);
  </script>
</body>
</html>
"@

Set-Content -LiteralPath $Out -Value $html -Encoding UTF8
Start-Process $Out
Write-Host "Wrote map to $Out"
