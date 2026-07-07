-- SQL Database Initialization for phpMyAdmin
-- Database: manajemen_kkn

CREATE DATABASE IF NOT EXISTS `manajemen_kkn`;
USE `manajemen_kkn`;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nim` VARCHAR(20) NOT NULL COMMENT 'Used as the username for login',
  `password` VARCHAR(255) NOT NULL COMMENT 'Stored password (preferably bcrypt hash)',
  `nama_lengkap` VARCHAR(100) DEFAULT NULL,
  `role` ENUM('admin', 'mahasiswa') NOT NULL DEFAULT 'mahasiswa',
  `jabatan` VARCHAR(50) DEFAULT 'Anggota',
  `last_login` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nim` (`nim`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--
-- Seed User:
-- NIM (username): 1234567890
-- Password: password123 (hashed using bcrypt)
--

INSERT INTO `users` (`nim`, `password`, `nama_lengkap`, `role`) 
VALUES 
(
  'admin', 
  '$2b$10$dsDmFAli3RRnBKAHArlPAO5PJEGkLhDQSO1OtGt1XTjCibijyENR6', 
  'Administrator',
  'admin'
),
(
  '1234567890', 
  '$2b$10$dsDmFAli3RRnBKAHArlPAO5PJEGkLhDQSO1OtGt1XTjCibijyENR6', 
  'Mahasiswa Demo',
  'mahasiswa'
)
ON DUPLICATE KEY UPDATE `nama_lengkap` = VALUES(`nama_lengkap`), `role` = VALUES(`role`);

-- Tabel untuk menyimpan pengaturan Geofencing Posko
CREATE TABLE IF NOT EXISTS `posko_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lat` DECIMAL(10, 8) NOT NULL,
  `lng` DECIMAL(11, 8) NOT NULL,
  `radius` INT NOT NULL,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan pengaturan Periode KKN
CREATE TABLE IF NOT EXISTS `periode_kkn` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk merekam jejak Absensi Mahasiswa
CREATE TABLE IF NOT EXISTS `absensi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `tanggal` DATE NOT NULL,
  `waktu` TIME NOT NULL,
  `status` ENUM('hadir', 'izin', 'sakit') DEFAULT 'hadir',
  `alasan` VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Tabel untuk menyimpan Pengelompokan PIC dan Proker
CREATE TABLE IF NOT EXISTS `pic_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama_pic` VARCHAR(255) NOT NULL,
  `proker` VARCHAR(255) NOT NULL,
  `folder_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel jembatan untuk menyimpan daftar mahasiswa di tiap kelompok PIC
CREATE TABLE IF NOT EXISTS `pic_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pic_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  FOREIGN KEY (`pic_id`) REFERENCES `pic_groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Tabel untuk menyimpan daftar Folder Kelompok KKN (Mendukung Sub-folder)
CREATE TABLE IF NOT EXISTS `arsip_folders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `parent_id` INT DEFAULT NULL,
  `nama_folder` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_id`) REFERENCES `arsip_folders`(`id`) ON DELETE CASCADE
);

-- Tabel untuk manajemen berkas (File Explorer) per Folder
CREATE TABLE IF NOT EXISTS `arsip_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `folder_id` INT DEFAULT NULL,
  `tipe_file` VARCHAR(50) NOT NULL,
  `nama_file` VARCHAR(255) NOT NULL,
  `url_file` VARCHAR(255) NOT NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`folder_id`) REFERENCES `arsip_folders`(`id`) ON DELETE CASCADE
);
