# Panduan & Rencana Hosting Produksi (Office Agents 2.5D)
> Disusun oleh: **Bima — Programmer** & **Satria — Keamanan**  
> Status: **Dokumen Arsitektur Siap Pakai**

---

## 1. Arsitektur Teknis Sistem & Kebutuhan Runtime

Aplikasi **Office Agents 2.5D** dibangun dengan arsitektur modern monorepo:
- **Frontend Diorama 3D:** React + Three.js r128 (PBR WebGL) yang dibundle via Vite. Menghidangkan file statis aset 3D (`.glb`) di direktori `/models/`.
- **Backend Service:** Node.js (v20+) yang menjalankan server REST API (`/api/state`) dan WebSocket bi-directional (`/ws`) untuk telemetri status 10 agen, scanner keamanan, serta git service.
- **Protokol:** Memerlukan dukungan **HTTPS** (`http/2` atau `http/1.1`) dan **WSS** (*Secure WebSocket*).

---

## 2. Perbandingan Opsi Hosting

| Kriteria | Opsi A: PaaS Container (Railway / Render) | Opsi B: VPS Mandiri (Hetzner / DigitalOcean) | Opsi C: Hybrid (Vercel + Railway) |
|---|---|---|---|
| **Kemudahan Setup** | ⭐⭐⭐⭐⭐ (Sangat Mudah, Zero DevOps) | ⭐⭐⭐ (Perlu setup Nginx/Docker) | ⭐⭐⭐⭐ (Mudah) |
| **Dukungan WebSocket** | Out-of-the-box (Otomatis WSS) | Penuh (via Caddy/Nginx reverse proxy) | Penuh (WebSocket diarahkan ke Railway) |
| **Estimasi Biaya** | Gratis s/d ~$5/bulan (Pay-per-use) | ~$4 – $5/bulan (Flat, kapasitas besar) | Gratis (Vercel) + ~$5 (Railway) |
| **CI/CD Otomatis** | Ya (Auto-build setiap `git push main`) | Via GitHub Actions SSH Deploy | Ya (Vercel & Railway GitHub Integrations) |
| **Rekomendasi** | **Sangat Direkomendasikan untuk Rilis Cepat** | **Paling Hemat untuk Jangka Panjang** | **Alternatif Skala Global** |

---

## 3. Rencana Eksekusi: Opsi A (Railway / Render — Paling Cepat & Direkomendasikan)

### Mengapa Railway / Render?
1. Mendukung WebSocket secara *native* tanpa perlu pusing konfigurasi SSL/TLS sertifikat.
2. Setiap kali kamu menjalankan `git push origin main`, Railway otomatis mendeteksi perubahan, mengompilasi TypeScript, mem-build frontend, dan merilis versi terbaru tanpa downtime.

### Konfigurasi Dockerfile Multi-Stage Produksi
Buat file `Dockerfile` di root repositori:

```dockerfile
# Multi-stage Dockerfile for Office Agents 2.5D
FROM node:20-alpine AS builder

WORKDIR /app

# Salin dependencies manifest
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/
COPY workspace/office-next/package*.json ./workspace/office-next/

# Install dependencies
RUN npm ci

# Salin source code
COPY . .

# Build paket shared, server, dan frontend office-next
RUN npm run build
RUN npx vite build workspace/office-next

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/workspace/office-next/dist ./public-stage

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
```

---

## 4. Rencana Eksekusi: Opsi B (VPS Mandiri — Hetzner / DigitalOcean / IDCloudHost)

Jika ingin biaya tetap termurah (~$4/bulan) dengan resource RAM 2GB penuh:

### Arsitektur di VPS:
```
Internet ──> Cloudflare DNS ──> Port 80/443 (Caddy Web Server)
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        Static 3D Diorama (/dist)             Node.js Backend & WebSocket (:3000)
```

### Konfigurasi `Caddyfile` (Reverse Proxy + Auto SSL):
Caddy secara otomatis mengurus sertifikat SSL Let's Encrypt tanpa konfigurasi manual:

```caddyfile
office.domainkamu.com {
    encode gzip zstd

    # Route WebSocket
    handle /ws {
        reverse_proxy localhost:3000
    }

    # Route API
    handle /api/* {
        reverse_proxy localhost:3000
    }

    # Route Frontend Diorama 3D
    handle {
        root * /var/www/office-next/dist
        file_server
        try_files {path} /index.html
    }
}
```

---

## 5. Checklist Sebelum Rilis ke Publik (Pre-Flight Checklist)

1. [x] **Typecheck & Unit Test:** `npm run typecheck` (0 errors) & `npm test` (26/26 passed).
2. [x] **Aset 3D Statis:** Semua file `.glb` tersimpan di `workspace/office-next/public/models/`.
3. [x] **Keamanan Secret:** Scanner keamanan deterministik memastikan tidak ada private key, API credentials, atau data sensitif yang bocor ke bundle frontend.
4. [ ] **Domain & DNS:** Arahkan DNS Record (A Record atau CNAME) ke IP VPS atau Railway Domain.
5. [ ] **Environment Variables:**
   - `PORT=3000`
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://office.domainkamu.com`
