# EmPay HRMS: Database System Explained

This document provides a comprehensive explanation of the database infrastructure for the EmPay HRMS backend. It covers everything from the initial connection to schema definition, migrations, and data seeding. All related files are located in the `empay-backend/src/db/` directory.

---

## 1. `connection.js` - The Connection Pool

This file is the heart of the database communication. It creates and exports a MySQL connection pool.

**What it does:**
*   Uses the `mysql2/promise` library to connect to the MySQL server.
*   Reads database credentials (host, user, password, database name) from environment variables (`.env` file) for security and flexibility, with sensible defaults for local development.
*   Creates a **connection pool** (`mysql.createPool`).

**Why use a connection pool?**
Instead of creating a new connection for every single query (which is slow and inefficient), a connection pool maintains a set of active connections that can be reused. When the application needs to run a query, it "borrows" a connection from the pool and "releases" it back when done. This dramatically improves performance and scalability.

---

## 2. `schema.sql` - The Blueprint

This file contains the `CREATE TABLE` statements for all the tables in the `empay_db` database. It serves as the definitive blueprint for the database structure.

**What it does:**
*   Defines the structure, columns, data types, relationships (foreign keys), and constraints (unique keys, primary keys) for every table: `users`, `employees`, `attendance`, `time_off_requests`, `leave_balances`, and `payroll`.
*   It is a reference document for understanding the data model of the entire application.

*(For a detailed breakdown of each table, refer to the `schema_explanation.md` file.)*

---

## 3. `init.js` - The Initial Setup Script

This is a powerful, all-in-one script designed to set up a fresh database from scratch. It is typically run only once when first setting up the development environment.

**What it does:**
1.  **Connects to MySQL:** Establishes a connection to the MySQL server.
2.  **Creates Database:** Runs `CREATE DATABASE IF NOT EXISTS empay_db` to ensure the database exists.
3.  **Creates Tables:** Executes all the `CREATE TABLE` statements found in `schema.sql` to build the database structure.
4.  **Seeds Initial Data:** Inserts a default set of users and employee profiles into the `users` and `employees` tables. This includes:
    *   An `admin`, `hr_officer`, and `payroll_officer` with default credentials.
    *   Several sample `employee` users.
    *   Corresponding employee profiles for all created users.
    *   Default leave balances for all employees for the current year.
5.  **Outputs Credentials:** Logs the default login credentials to the console for easy access during development.

This script is invoked by running `npm run init` from the `empay-backend` directory.

---

## 4. Migration Scripts: `migrate.js` & `migrate-login-ids.js`

Migrations are scripts used to make incremental and controlled changes to an existing database schema without having to wipe and recreate it.

### `migrate.js`
This is the main migration script. Its purpose is to add new columns to tables that were added after the initial schema was designed.

**What it does:**
*   It checks if specific columns (like `wage`, `manager_id`, `location` in the `employees` table) exist.
*   If a column is missing, it runs an `ALTER TABLE ... ADD COLUMN ...` statement to add it.
*   This approach makes the script safe to run multiple times, as it will only apply changes that haven't been applied yet.
*   It also performs data backfilling, such as populating the new `login_id` on the `users` table with the `employee_code` for existing records.

This script is invoked by running `npm run migrate`. It was created to fix the "Internal Server Error" caused by the application code trying to access columns that didn't exist in the initial database schema.

### `migrate-login-ids.js`
This is a more specialized, one-off migration script.

**What it does:**
*   It iterates through all existing employees and regenerates their `login_id` based on a new, more structured format (`EP` + name parts + year + serial number).
*   This is an example of a data migration, where the goal is to update the data itself, not just the schema.

---

## 5. Seeding Scripts: `seed.js` & `seed-attendance.js`

Seeding is the process of populating a database with initial or dummy data. This is extremely useful for development and testing, as it provides a consistent dataset to work with.

### `seed.js`
This script is very similar to `init.js` but is focused purely on inserting data.

**What it does:**
*   Inserts a standard set of users (`admin`, `hr`, `payroll`, and sample employees) with hashed passwords.
*   Creates corresponding employee profiles for these users.
*   Sets up initial leave balances for all created employees.
*   It uses `INSERT IGNORE` to avoid errors if the data already exists, making it safe to run multiple times.

### `seed-attendance.js`
This script is designed to populate the `attendance` table with dummy data for the current day.

**What it does:**
*   Fetches all employees from the database.
*   Iterates through them and creates an attendance record for today with a varied status (`present`, `on_leave`, `absent`).
*   For employees marked as `on_leave`, it also creates a corresponding approved `time_off_requests` record to ensure data consistency.
*   This is useful for testing features on the dashboard and employees page that show today's attendance status.
