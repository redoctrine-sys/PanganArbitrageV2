$steps = "C:\Users\SOLOARSI\.gemini\antigravity\brain\5f6a67a1-4a72-4aaf-84cc-b8bf09acb3c3\.system_generated\steps"
$raw = Get-Content "$steps\148\content.md" -Raw
$json = $raw -replace '(?s)^.*?(\{.*)', '$1'
$data = ($json | ConvertFrom-Json).data
Write-Host "Total rows (cache-bust): $($data.Count)"
$cities = $data | ForEach-Object { "$($_.kode_wilayah)|$($_.city_raw)" } | Sort-Object -Unique
Write-Host "Total unique cities: $($cities.Count)"
