param(
  [Parameter(Mandatory=$true)][string]$Hex,
  [int]$Hours = 6,
  [string]$Out = ".\SkyMap.html"
)

# --- config
$ClientId     = "nycrobaviation-api-client"
$ClientSecret = "FwwMtVdibhXWnUSecaPGJj1r4xSi2MIQ"
$TokenUrl     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
$Inv = [System.Globalization.CultureInfo]::InvariantCulture

function Get-OsToken {
  $body = "grant_type=client_credentials&client_id=$ClientId&client_secret=$ClientSecret"
  for($i=0;$i -lt 3;$i++){
    try {
      $r = Invoke-RestMethod -Method POST -Uri $TokenUrl `
        -ContentType "application/x-www-form-urlencoded" -Body $body -ErrorAction Stop
      if($r.access_token){ return $r.access_token }
    } catch {
      Write-Host "Auth attempt $($i+1) failed, retrying..." -ForegroundColor Yellow
      Start-Sleep -Seconds (2*$i + 1)
    }
  }
  throw "OpenSky OAuth failed after 3 attempts."
}

function NowUnix { [int][double]::Parse((Get-Date -UFormat %s)) }

function Get-OpenSkyTracks([string]$hex){
  $hex = $hex.ToLower()
  $tok = Get-OsToken
  $hdr = @{ Authorization = "Bearer $tok" }
  $url = "https://opensky-network.org/api/tracks/all?icao24=$hex&time=$(NowUnix)"
  try { Invoke-RestMethod -Headers $hdr -Uri $url -Method GET -ErrorAction Stop } catch { $null }
}

function Get-RecentFlightOD([string]$hex,[int]$hours){
  $hex = $hex.ToLower()
  $tok = Get-OsToken
  $hdr = @{ Authorization = "Bearer $tok" }
  $end   = NowUnix
  $begin = $end - ($hours * 3600)
  $url = "https://opensky-network.org/api/flights/aircraft?icao24=$hex&begin=$begin&end=$end"
  $f=$null
  try { $f = Invoke-RestMethod -Headers $hdr -Uri $url -Method GET -ErrorAction Stop } catch { $f=@() }
  if (-not $f) { return $null }
  $f | Sort-Object timeDeparture -Descending | Select-Object -First 1
}

function fmtUtc($unix){ if($unix){ ([DateTimeOffset]::FromUnixTimeSeconds([int]$unix)).UtcDateTime.ToString("u") } else { "Unknown" } }
function fmtDur($sec){ if(-not $sec -or $sec -lt 0){ "—" } else { ("{0:hh\:mm}" -f [TimeSpan]::FromSeconds([int]$sec)) } }

# --- data
try { $tracks = Get-OpenSkyTracks $Hex } catch { Write-Error $_.Exception.Message; exit 1 }
if(-not $tracks -or -not $tracks.path){ Write-Error "No track data"; exit 2 }

$path = $tracks.path  # [time, lat, lon, baroAlt, trueTrack, onGround]
$coords=@()
$firstSeen=$null; $lastSeen=$null
foreach($p in $path){
  if($p[1] -and $p[2]){ $coords += ,@([double]$p[1],[double]$p[2]) }
  if(-not $firstSeen -and $p[0]){ $firstSeen = [int]$p[0] }
  if($p[0]){ $lastSeen = [int]$p[0] }
}
if($coords.Count -lt 1){ Write-Error "Track had no coordinates"; exit 3 }

$end = $coords[-1]
$lat0 = [string]::Format($Inv,"{0}",$end[0])
$lon0 = [string]::Format($Inv,"{0}",$end[1])

$flight = Get-RecentFlightOD $Hex $Hours
$callsign = if($tracks.callSign){ $tracks.callSign.Trim() } elseif($flight -and $flight.callsign){ $flight.callsign.Trim() } else { $Hex.ToLower() }
$depIcao = if($flight -and $flight.estDepartureAirport){ $flight.estDepartureAirport } else { "Unknown" }
$arrIcao = if($flight -and $flight.estArrivalAirport){ $flight.estArrivalAirport } else { "Unknown" }

$depUnix = if($flight -and $flight.timeDeparture){ [int]$flight.timeDeparture } elseif($firstSeen){ $firstSeen } else { $null }
$arrUnix = if($flight -and $flight.timeArrival){ [int]$flight.timeArrival } else { $null }
$nowUnix = NowUnix
$inAirSec = if($depUnix){ if($arrUnix){ $arrUnix - $depUnix } else { $nowUnix - $depUnix } } else { $null }
$status = if($arrUnix){ "Landed" } else { "En-route" }

# --- format data
$jsCoords = ($coords | ForEach-Object { "[{0},{1}]" -f ([string]::Format($Inv,"{0}",$_[0])),([string]::Format($Inv,"{0}",$_[1])) }) -join ","
$depStr = fmtUtc $depUnix
$arrStr = if($arrUnix){ fmtUtc $arrUnix } else { "—" }
$durStr = if($inAirSec){ fmtDur $inAirSec } else { "—" }
$nowStr = (Get-Date).ToUniversalTime().ToString("u")

# --- HTML output
$html = @"
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Sky-Key • $callsign ($depIcao → $arrIcao)</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body{height:100%;margin:0;font:14px system-ui,Segoe UI,Roboto,Arial}
  #wrap{display:flex;height:100%}
  #panel{width:320px;max-width:40vw;border-right:1px solid #e2e2e2;padding:16px;box-sizing:border-box}
  #map{flex:1}
  .h1{font-size:18px;font-weight:600;margin:0 0 8px}
  .row{margin:6px 0;display:flex;justify-content:space-between}
  .label{color:#666}
  .val{font-weight:600}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #ccc;font-size:12px}
  .muted{color:#888}
</style>
</head>
<body>
<div id="wrap">
  <div id="panel">
    <div class="h1">$callsign <span class="pill">$status</span></div>
    <div class="row"><div class="label">Origin</div><div class="val">$depIcao</div></div>
    <div class="row"><div class="label">Destination</div><div class="val">$arrIcao</div></div>
    <div class="row"><div class="label">Departure (UTC)</div><div class="val">$depStr</div></div>
    <div class="row"><div class="label">Time in flight</div><div class="val">$durStr</div></div>
    <div class="row"><div class="label">Arrival (UTC)</div><div class="val">$arrStr</div></div>
    <div class="row"><div class="label">Last update</div><div class="val">$nowStr</div></div>
    <div class="muted" style="margin-top:12px">Data: OpenSky tracks/flights. Some fields may be unknown in real time.</div>
  </div>
  <div id="map"></div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const coords = [$jsCoords]; // [lat,lon]
  const lat0 = $lat0, lon0 = $lon0;

  const map = L.map('map').setView([lat0, lon0], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  if (coords.length > 1) {
    const poly = L.polyline(coords, {weight:4, opacity:0.9, color:'#1976d2'}).addTo(map);
    map.fitBounds(poly.getBounds().pad(0.2));
  } else {
    map.setView([lat0, lon0], 9);
  }

  const start = coords[0], end = coords[coords.length-1];
  L.marker(start).addTo(map).bindPopup("Start");
  L.marker(end).addTo(map).bindPopup("Current/End");
</script>
</body>
</html>
"@

Set-Content -LiteralPath $Out -Value $html -Encoding UTF8
Start-Process $Out
Write-Host "Wrote map with panel to $Out"
