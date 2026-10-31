param(
    [string]$JsonPath = "data\konveksi-data.json",
    [string]$SqlPath = "backup.sql"
)

if (-not (Test-Path $JsonPath)) {
    Write-Warning "File JSON tidak ditemukan: $JsonPath"
    exit 1
}

$raw = Get-Content -Raw -Path $JsonPath -Encoding UTF8
$data = $raw | ConvertFrom-Json

$out = @()
$out += "-- ============================================================"
$out += "-- BACKUP DATABASE SISTEM KONVEKSI (SQL DUMP)"
$out += "-- Tanggal Export: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$out += "-- ============================================================"
$out += "BEGIN TRANSACTION;"
$out += ""

foreach ($prop in $data.PSObject.Properties) {
    $tableName = $prop.Name
    $rows = $prop.Value
    if ($null -eq $rows -or $rows.Count -eq 0) { continue }

    $out += "-- ------------------------------------------------------------"
    $out += "-- Tabel: $tableName"
    $out += "-- ------------------------------------------------------------"
    $out += "CREATE TABLE IF NOT EXISTS $tableName ("
    $out += "    id INTEGER PRIMARY KEY,"
    $out += "    data_json TEXT,"
    $out += "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    $out += ");"
    
    foreach ($row in $rows) {
        $rowId = "NULL"
        if ($null -ne $row.id) { $rowId = $row.id }
        $rowJson = ($row | ConvertTo-Json -Compress -Depth 10) -replace "'", "''"
        $out += "INSERT INTO $tableName (id, data_json) VALUES ($rowId, '$rowJson');"
    }
    $out += ""
}

$out += "COMMIT;"
$out | Set-Content -Path $SqlPath -Encoding UTF8
Write-Output "[OK] SQL Dump berhasil diexport: $SqlPath"

