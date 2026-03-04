-- Create database if not exists
CREATE DATABASE IF NOT EXISTS travel_planner;
USE travel_planner;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100),
  displayName VARCHAR(255),
  profilePhoto VARCHAR(500),
  passwordHash VARCHAR(255), -- 只有本地註冊才會有
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  isActive BOOLEAN DEFAULT TRUE,
  INDEX idx_email (email)
);

-- Users OAuth Table
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  provider VARCHAR(50) NOT NULL,       -- google, github...
  providerUserId VARCHAR(255) NOT NULL, -- Google 給你的 sub
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, providerUserId),
  INDEX idx_userId (userId)
);


-- OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  oauthAccountId INT NOT NULL,
  refreshToken VARCHAR(500),
  expiresAt DATETIME,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (oauthAccountId) REFERENCES user_oauth_accounts(id) ON DELETE CASCADE
);

-- Itineraries Table
CREATE TABLE IF NOT EXISTS itineraries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  title VARCHAR(255),
  summary TEXT,
  city VARCHAR(100),
  startDate DATE,
  itineraryData LONGTEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  isPublic BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
);
