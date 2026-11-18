@echo off
title Office Agents Stopper
echo Mematikan seluruh proses Office Agents dan 9router...
where tailscale >nul 2>nul && (tailscale funnel reset >nul 2>nul && echo Tailscale Funnel ditutup.)
powershell -Command "$ports = @(20128, 7420, 7421, 5173); $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }; if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Output \"Stopped PID $_\"; } } else { Write-Output 'Semua port sudah bersih.'; }"
echo Selesai! Semua layanan telah dimatikan.
pause
