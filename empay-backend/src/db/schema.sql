-- EmPay HRMS Database Schema
-- Run this file to set up the database

CREATE DATABASE IF NOT EXISTS empay_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE empay_db;

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee','hr_officer','payroll_officer') NOT NULL DEFAULT 'employee',
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employees table (profile data)
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  designation VARCHAR(100),
  date_of_joining DATE,
  phone VARCHAR(20),
  address TEXT,
  pan_number VARCHAR(20),
  uan_number VARCHAR(20),
  bank_account VARCHAR(50),
  basic_salary DECIMAL(12,2) DEFAULT 0.00,
  hra DECIMAL(12,2) DEFAULT 0.00,
  standard_allowance DECIMAL(12,2) DEFAULT 1500.00,
  performance_bonus DECIMAL(12,2) DEFAULT 0.00,
  lta DECIMAL(12,2) DEFAULT 2000.00,
  fixed_allowance DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  check_in DATETIME,
  check_out DATETIME,
  total_hours DECIMAL(5,2) DEFAULT 0.00,
  status ENUM('present','absent','half_day','on_leave') DEFAULT 'absent',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_attendance (employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Time off requests
CREATE TABLE IF NOT EXISTS time_off_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT DEFAULT 1,
  reason TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by INT,
  reviewed_at DATETIME,
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL,
  total_allocated INT DEFAULT 0,
  used INT DEFAULT 0,
  year INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_balance (employee_id, leave_type, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  pay_period_month INT NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
  pay_period_year INT NOT NULL,
  working_days INT DEFAULT 26,
  days_worked DECIMAL(5,1) DEFAULT 0,
  basic_salary DECIMAL(12,2) DEFAULT 0,
  hra DECIMAL(12,2) DEFAULT 0,
  standard_allowance DECIMAL(12,2) DEFAULT 0,
  performance_bonus DECIMAL(12,2) DEFAULT 0,
  lta DECIMAL(12,2) DEFAULT 0,
  fixed_allowance DECIMAL(12,2) DEFAULT 0,
  gross_earnings DECIMAL(12,2) DEFAULT 0,
  pf_employee DECIMAL(12,2) DEFAULT 0,
  pf_employer DECIMAL(12,2) DEFAULT 0,
  professional_tax DECIMAL(12,2) DEFAULT 0,
  tds DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2) DEFAULT 0,
  status ENUM('draft','processed','paid') DEFAULT 'draft',
  generated_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_payroll (employee_id, pay_period_month, pay_period_year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);
