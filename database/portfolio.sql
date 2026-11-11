CREATE DATABASE IF NOT EXISTS portfolio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE portfolio;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  tagline VARCHAR(120) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  theme ENUM('one', 'two', 'three') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_projects_year CHECK (`year` BETWEEN 2000 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  message VARCHAR(5000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO projects (id, title, category, `year`, tagline, description, theme)
VALUES
  (
    1,
    'Verdant',
    'Digital experience · Lifestyle',
    2025,
    'Grow at your own pace',
    'A calm digital experience for people who want to bring a little more green into everyday life.',
    'one'
  ),
  (
    2,
    'Northstar',
    'Brand & web · Travel',
    2025,
    'A map for the curious',
    'A travel concept designed to help curious people find their next meaningful adventure.',
    'two'
  ),
  (
    3,
    'Common Ground',
    'Community platform · Social good',
    2026,
    'Made for the neighborhood',
    'A neighborhood platform that makes it easier for people to find and support their local community.',
    'three'
  );
