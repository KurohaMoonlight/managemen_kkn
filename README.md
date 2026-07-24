# Sistem Manajemen KKN

Sistem informasi berbasis Web untuk manajemen kegiatan, absensi, keuangan, dan buku tamu Kuliah Kerja Nyata (KKN). Terdiri dari antarmuka modern berbasi **Vue.js** dan backend tangguh menggunakan **Node.js (Express)** serta **MySQL**.

## Persyaratan Sistem (System Requirements)
Sebelum memulai instalasi, pastikan sistem Anda sudah terpasang:
- **Node.js** (Versi 18 atau lebih baru)
- **MySQL** / MariaDB
- **Python 3** (Wajib, untuk fitur Auto-Trace Ekstraksi Tanda Tangan)
- **Git** (Untuk menarik/mengelola kode)

---

## 💻 Panduan Instalasi di Komputer Lokal (Development)

Jika Anda ingin menjalankan aplikasi ini di komputer sendiri (Windows/Mac/Linux) untuk keperluan pengembangan:

### 1. Kloning Repositori & Masuk Folder
```bash
git clone https://github.com/KurohaMoonlight/managemen_kkn.git
cd managemen_kkn
```

### 2. Konfigurasi Database
1. Buat database kosong di MySQL Anda (misalnya `kkn_db`).
2. Masuk ke folder `backend`:
   ```bash
   cd backend
   ```
3. Salin file konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
4. Buka file `.env` dan sesuaikan kredensial database Anda (DB_USER, DB_PASSWORD, DB_NAME, dll).
5. Jalankan skrip *reset* database untuk menginisialisasi tabel dasar (Hati-hati: ini akan menghapus data lama jika ada):
   ```bash
   node reset_db.mjs
   ```

### 3. Instalasi Dependencies & Python OpenCV
**Untuk Backend:**
```bash
# Posisi masih di dalam folder backend/
npm install
```
**Untuk Frontend:**
```bash
cd ../frontend
npm install
```
**Untuk Python (Fitur Auto-Trace Tanda Tangan):**
Pastikan Anda sudah menginstal library OpenCV di Python:
```bash
pip install opencv-python numpy
```

### 4. Menjalankan Aplikasi
Anda perlu membuka 2 terminal untuk menjalankan frontend dan backend secara bersamaan:

**Terminal 1 (Backend):**
```bash
cd backend
npm run start
# (atau node server.js)
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
Buka browser Anda di URL yang tertera di terminal frontend (biasanya `http://localhost:5173`).

---

## 🚀 Panduan Instalasi di VPS (Production Deployment)

Panduan ini dikhususkan untuk sistem operasi **Ubuntu/Debian**. Untuk server *production*, kita akan mem-*build* file statis frontend, dan menggunakan **PM2** untuk menjaga backend tetap menyala.

### 1. Instalasi Aplikasi Dasar di VPS
Akses VPS Anda via SSH, lalu jalankan:
```bash
sudo apt update
# Install Node.js, NPM, MySQL Server, Python3, dan Nginx
sudo apt install nodejs npm mysql-server python3 python3-pip nginx -y

# Install OpenCV via APT (Untuk menghindari error 'externally-managed-environment' pada PIP)
sudo apt install python3-opencv -y

# Install PM2 secara global
sudo npm install -g pm2
```

### 2. Kloning & Pengaturan Folder
```bash
cd /var/www
sudo git clone https://github.com/KurohaMoonlight/managemen_kkn.git sistem_manajemen_kkn
cd sistem_manajemen_kkn
```

### 3. Setup Backend & Database
1. Buka terminal MySQL: `sudo mysql`
2. Buat database: `CREATE DATABASE kkn_db;`
3. Masuk ke folder backend: `cd backend`
4. Buat `.env` dan atur databasenya.
5. Jalankan `npm install`.
6. Migrasi database: `node reset_db.mjs`
7. Nyalakan server dengan PM2:
   ```bash
   pm2 start server.js --name "kkn-backend"
   pm2 save
   pm2 startup
   ```

### 4. Setup Frontend (Build)
Masuk ke folder frontend dan *build* file statisnya:
```bash
cd ../frontend
npm install
npm run build
```
*(Perintah ini akan menghasilkan folder `dist/` yang berisi file web statis yang sudah dikompres).*

### 5. Konfigurasi Nginx
Agar domain Anda (misal `kknpusing.my.id`) mengarah ke aplikasi:
1. Edit konfigurasi default Nginx: `sudo nano /etc/nginx/sites-available/default`
2. Atur letak folder statisnya ke `dist/` frontend, dan arahkan `/api` ke backend Node.js (contoh konfigurasi dasar):
```nginx
server {
    listen 80;
    server_name kknpusing.my.id;

    # Melayani file Frontend Vue (dist)
    root /var/www/sistem_manajemen_kkn/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy ke Backend API (Asumsi jalan di port 3000)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
3. Uji coba dan restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

Selesai! Aplikasi Anda kini sudah berjalan 24/7 di VPS Anda secara *live*.
