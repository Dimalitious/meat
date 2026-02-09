# ============================================
# RBAC API Verification Script
# ============================================
# Usage: .\scripts\test-rbac.ps1
# Requires: server running on localhost:3000
# Pre-req: run `npx ts-node --transpile-only src/scripts/create-test-user.ts`
# ============================================

$BASE = "http://localhost:3000"
$pass = 0
$fail = 0

function Test-Api {
    param([string]$Label, [string]$Method, [string]$Uri, $Headers, $Body, [int]$Expect)
    try {
        $params = @{ Uri = "$BASE$Uri"; Method = $Method; TimeoutSec = 5 }
        if ($Headers) { $params.Headers = $Headers }
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params -UseBasicParsing
        $status = $r.StatusCode
    } catch {
        $status = $_.Exception.Response.StatusCode.Value__
    }
    if ($status -eq $Expect) {
        Write-Host "  PASS $Label -> $status" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  FAIL $Label -> expected $Expect, got $status" -ForegroundColor Red
        $script:fail++
    }
    return $status
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " RBAC API Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# --- 1) Health ---
Write-Host "--- 1. Health ---" -ForegroundColor Yellow
Test-Api "GET /health" GET "/health" $null $null 200

# --- 2) Auth (admin) ---
Write-Host "`n--- 2. Auth (admin login + /me) ---" -ForegroundColor Yellow
$body = '{"username":"admin","password":"admin"}'
try {
    $login = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 5
    $token = $login.token
    $h = @{ Authorization = "Bearer $token" }
    Write-Host "  PASS Login as admin" -ForegroundColor Green; $pass++
} catch {
    Write-Host "  FAIL Login as admin: $($_.Exception.Message)" -ForegroundColor Red; $fail++
    Write-Host "  Cannot continue. Exiting." -ForegroundColor Red; exit 1
}

# /me
try {
    $me = Invoke-RestMethod -Uri "$BASE/api/auth/me" -Method GET -Headers $h -TimeoutSec 5
    Write-Host "  PASS GET /api/auth/me -> roles=$($me.roles -join ','), perms=$($me.permissions.Count), fallback=$($me._rbac.fallbackUsed)" -ForegroundColor Green; $pass++
} catch {
    Write-Host "  FAIL GET /api/auth/me: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# /api/health/rbac (authenticated)
try {
    $rbac = Invoke-RestMethod -Uri "$BASE/api/health/rbac" -Method GET -Headers $h -TimeoutSec 5
    Write-Host "  PASS GET /api/health/rbac -> seeded=$($rbac.rbacSeeded), fallbackEnabled=$($rbac.fallbackEnabled)" -ForegroundColor Green; $pass++
} catch {
    Write-Host "  FAIL GET /api/health/rbac: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# --- 3) Register guard ---
Write-Host "`n--- 3. Register guard (expect 404) ---" -ForegroundColor Yellow
Test-Api "POST /api/auth/register" POST "/api/auth/register" $null '{"username":"x","password":"x","name":"x"}' 404

# --- 4) No-token access ---
Write-Host "`n--- 4. No-token (expect 401) ---" -ForegroundColor Yellow
Test-Api "POST /api/import/excel (no token)" POST "/api/import/excel" $null $null 401
Test-Api "GET /api/purchases (no token)" GET "/api/purchases" $null $null 401

# --- 5) ADMIN bypass ---
Write-Host "`n--- 5. ADMIN bypass (expect 200) ---" -ForegroundColor Yellow
Test-Api "ADMIN GET /api/purchases" GET "/api/purchases" $h $null 200

# --- 6) Restricted user (EXPEDITOR) ---
Write-Host "`n--- 6. Restricted user (EXPEDITOR) ---" -ForegroundColor Yellow
$rbody = '{"username":"exp1","password":"exp1"}'
try {
    $rlogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -ContentType "application/json" -Body $rbody -TimeoutSec 5
    $rtoken = $rlogin.token
    $rh = @{ Authorization = "Bearer $rtoken" }
    Write-Host "  PASS Login as exp1" -ForegroundColor Green; $pass++

    # /me check
    $rme = Invoke-RestMethod -Uri "$BASE/api/auth/me" -Method GET -Headers $rh -TimeoutSec 5
    Write-Host "  INFO exp1 roles=$($rme.roles -join ','), perms=$($rme.permissions.Count)"
    if ($rme.permissions -contains 'admin.audit') {
        Write-Host "  FAIL exp1 has admin.audit!" -ForegroundColor Red; $fail++
    } else {
        Write-Host "  PASS exp1 does NOT have admin.audit" -ForegroundColor Green; $pass++
    }

    # Should be 200
    Test-Api "EXPEDITOR GET /api/orders" GET "/api/orders" $rh $null 200

    # Should be 403
    Test-Api "EXPEDITOR GET /api/purchases (expect 403)" GET "/api/purchases" $rh $null 403
    Test-Api "EXPEDITOR POST /api/import/excel (expect 403)" POST "/api/import/excel" $rh $null 403

    # --- 7) EXPEDITOR vs production-v2 (expect 403) ---
    Write-Host "`n--- 7. EXPEDITOR vs production-v2 (expect 403) ---" -ForegroundColor Yellow
    Test-Api "EXPEDITOR GET /api/production-v2/runs (expect 403)" GET "/api/production-v2/runs" $rh $null 403
    Test-Api "EXPEDITOR POST /api/production-v2/runs (expect 403)" POST "/api/production-v2/runs" $rh $null 403
    Test-Api "EXPEDITOR GET /api/production-v2/mml (expect 403)" GET "/api/production-v2/mml" $rh $null 403

    # --- 8) ADMIN prices/purchase (expect 200, not 500) ---
    Write-Host "`n--- 8. ADMIN prices/purchase validation ---" -ForegroundColor Yellow
    Test-Api "ADMIN GET /api/prices/purchase (expect 200)" GET "/api/prices/purchase" $h $null 200

} catch {
    Write-Host "  SKIP Restricted user tests: exp1 not found. Run:" -ForegroundColor Yellow
    Write-Host "    npx ts-node --transpile-only src/scripts/create-test-user.ts" -ForegroundColor DarkYellow
}

# --- Summary ---
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Results: $pass PASS / $fail FAIL" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================`n" -ForegroundColor Cyan
