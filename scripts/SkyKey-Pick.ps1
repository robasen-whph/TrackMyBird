param(
  [int]$Index = 1,          # 1 = first aircraft in list
  [switch]$Random,          # pick a random active aircraft
  [int]$List = 0,           # list the first N active aircraft (no run)
  [switch]$RunTrack,        # call .\SkyKey-Track.ps1 with the selected hex
  [int]$Hours = 6,          # pass-through to SkyKey-Track.ps1
  [string]$Out = ".\SkyMap.html"
)

# --- config (same creds you used before)
$ClientId     = "nycrobaviation-api-client"
$ClientSecret = "FwwMtVdibhXWnUSecaPGJj1r4xSi2MIQ"
$TokenUrl     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

function Get-OsToken {
  $body = "grant_type=client_credentials&client_id=$ClientId&client_secret=$ClientSecret"
  for($i=0;$i -lt 3;$i++){
    try{
      $r = Invoke-RestMethod -Method POST -Uri $TokenUrl -ContentType "application/x-www-form-urlencoded" -Body $body -ErrorAction Stop
      if($r.access_token){ return $r.access_token }
    }catch{ Start-Sleep -Seconds (2*$i + 1) }
  }
  throw "OpenSky OAuth failed after 3 attempts."
}

function Get-ActiveAirborne {
  $tok = Get-OsToken
  $hdr = @{ Authorization = "Bearer $tok" }
  $j = Invoke-RestMethod -Headers $hdr -Uri "https://opensky-network.org/api/states/all" -Method GET -ErrorAction Stop
  if(-not $j.states){ return @() }
  $seen = @{}
  $out = New-Object System.Collections.Generic.List[object]
  foreach($s in $j.states){
    $hex=$s[0]; $cs=($s[1] -as [string]).Trim(); $lat=$s[6]; $lon=$s[5]; $ong=$s[8]
    if(-not $hex -or $seen.ContainsKey($hex)){ continue }
    if($lat -and $lon -and -not $ong){
      $out.Add([pscustomobject]@{ hex=$hex; callsign=$cs; lat=$lat; lon=$lon })
      $seen[$hex]=$true
    }
  }
  $out
}

# --- run
$ac = Get-ActiveAirborne
if($List -gt 0){
  $ac | Select-Object -First $List | ForEach-Object {
    "{0,-8}  {1,-8}  lat {2:N3}  lon {3:N3}" -f $_.hex, ($_.callsign ?? ''), $_.lat, $_.lon
  } | Write-Host
  exit 0
}

if($ac.Count -eq 0){ Write-Error "No active airborne aircraft returned."; exit 2 }

if($Random){ $Index = Get-Random -Minimum 1 -Maximum ($ac.Count + 1) }
if($Index -lt 1 -or $Index -gt $ac.Count){ Write-Error "Index out of range. Active count: $($ac.Count)"; exit 3 }

$pick = $ac[$Index-1]
"Selected HEX: {0}  Callsign: {1}" -f $pick.hex, ($pick.callsign ?? '') | Write-Host

if($RunTrack){
  $track = Join-Path (Get-Location) "SkyKey-Track.ps1"
  if(-not (Test-Path $track)){ Write-Error "SkyKey-Track.ps1 not found in current directory."; exit 4 }
  & $track -Hex $pick.hex -Hours $Hours -Out $Out
}else{
  # print HEX for piping if desired
  $pick.hex
}
