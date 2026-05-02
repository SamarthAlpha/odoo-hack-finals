# EmPay HRMS Database Schema Explanation

This document provides a detailed explanation of the database schema for the EmPay HRMS project. The schema is defined in the `schema.sql` file and is designed to support all the core functionalities of the application, including user management, employee profiles, attendance, leave, and payroll.

## Database: `empay_db`

The project uses a single MySQL database named `empay_db`. It is created with `utf8mb4` character set and `utf8mb4_unicode_ci` collation to ensure full support for a wide range of characters and languages.

---

## 1. `users` Table

This table is the cornerstone of authentication and authorization in the application. It stores login credentials and assigns roles that determine user access levels.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee','hr_officer','payroll_officer') NOT NULL DEFAULT 'employee',
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Key Columns:

*   `id`: A unique auto-incrementing integer that serves as the primary key for the user.
*   `email`: The user's email address, which also functions as their username for login. It is unique to prevent duplicate accounts.
*   `password_hash`: Stores the user's password in a securely hashed format (using bcryptjs in the application) rather than plain text.
*   `role`: An `ENUM` type that defines the user's role within the system. This is critical for Role-Based Access Control (RBAC). The possible values are:
    *   `admin`: Superuser with unrestricted access.
    *   `employee`: Standard user with access to their own profile, attendance, and leave requests.
    *   `hr_officer`: Manages employee profiles and attendance.
    *   `payroll_officer`: Manages payroll, time off, and reports.
*   `is_active`: A boolean flag (`TINYINT(1)`) to activate or deactivate a user account without deleting it.

---

## 2. `employees` Table

This table stores the detailed profile information for each employee. It is linked to the `users` table via the `user_id`.

```sql
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  designation VARCHAR(100),
  date_of_joining DATE,
  -- ... other profile and salary component columns
  status ENUM('active','inactive') DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Key Columns:

*   `id`: A unique auto-incrementing integer that serves as the primary key for the employee record. This `id` is used as a foreign key in other tables like `attendance` and `payroll`.
*   `user_id`: A foreign key that links this employee record to a specific user in the `users` table. The `ON DELETE CASCADE` clause ensures that if a user is deleted, their corresponding employee record is also automatically deleted.
*   `employee_code`: A unique identifier for the employee within the company (e.g., `EMP001`).
*   **Profile Fields**: `first_name`, `last_name`, `department`, `designation`, `date_of_joining`, `phone`, `address`, etc., store the personal and professional details of the employee.
*   **Salary Components**: `basic_salary`, `hra`, `standard_allowance`, etc., store the breakdown of an employee's salary structure. These are used as a basis for payroll calculations.
*   `status`: An `ENUM` to mark an employee as 'active' or 'inactive' within the company.

---

## 3. `attendance` Table

This table logs the daily attendance records for each employee.

```sql
CREATE TABLE IF NOT EXISTS attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  check_in DATETIME,
  check_out DATETIME,
  total_hours DECIMAL(5,2) DEFAULT 0.00,
  status ENUM('present','absent','half_day','on_leave') DEFAULT 'absent',
  UNIQUE KEY unique_attendance (employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
```

### Key Columns:

*   `employee_id`: Foreign key linking to the `employees` table.
*   `date`: The specific date of the attendance record.
*   `check_in` / `check_out`: Timestamps for when an employee starts and ends their workday.
*   `total_hours`: Calculated duration of work for the day.
*   `status`: An `ENUM` indicating the attendance status for the day. This is crucial for payroll calculations.
*   `unique_attendance`: A unique key constraint on `(employee_id, date)` ensures that there can only be one attendance record per employee per day.

---

## 4. `time_off_requests` Table

This table manages all leave requests submitted by employees.

```sql
CREATE TABLE IF NOT EXISTS time_off_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by INT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### Key Columns:

*   `employee_id`: The employee who requested the time off.
*   `leave_type`: The category of leave being requested.
*   `start_date` / `end_date`: The duration of the leave.
*   `status`: Tracks the workflow of the leave request from `pending` to `approved` or `rejected`.
*   `reviewed_by`: A foreign key linking to the `users` table, storing who approved or rejected the request. `ON DELETE SET NULL` means if the reviewer's user account is deleted, this field will become `NULL` instead of deleting the leave request.

---

## 5. `leave_balances` Table

This table tracks the allocation and usage of different types of leave for each employee for a given year.

```sql
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL,
  total_allocated INT DEFAULT 0,
  used INT DEFAULT 0,
  year INT NOT NULL,
  UNIQUE KEY unique_balance (employee_id, leave_type, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
```

### Key Columns:

*   `total_allocated`: The total number of leave days of a certain type granted to the employee for the year.
*   `used`: The number of leave days already taken.
*   `year`: The calendar year for which the balance is applicable.
*   `unique_balance`: A unique key on `(employee_id, leave_type, year)` ensures that each employee has only one balance record per leave type per year.

---

## 6. `payroll` Table

This table stores the results of each payrun, effectively generating a payslip record for each employee for a specific month and year.

```sql
CREATE TABLE IF NOT EXISTS payroll (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  pay_period_month INT NOT NULL,
  pay_period_year INT NOT NULL,
  -- ... earnings and deductions columns
  gross_earnings DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2) DEFAULT 0,
  status ENUM('draft','processed','paid') DEFAULT 'draft',
  generated_by INT,
  UNIQUE KEY unique_payroll (employee_id, pay_period_month, pay_period_year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### Key Columns:

*   `pay_period_month` / `pay_period_year`: Defines the specific pay period for the record.
*   **Earnings & Deductions Columns**: This table contains a comprehensive breakdown of the salary calculation, including `gross_earnings`, `pf_employee`, `professional_tax`, `total_deductions`, and finally `net_pay`.
*   `status`: Tracks the state of the payslip, from `draft` to `processed` and finally `paid`.
*   `generated_by`: Stores which user (typically a Payroll Officer) generated this payroll record.
*   `unique_payroll`: A unique key on `(employee_id, pay_period_month, pay_period_year)` prevents duplicate payroll records for the same employee in the same pay period.
