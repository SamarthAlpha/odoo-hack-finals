# 🚀 EmPay HRMS (Human Resource Management System)

EmPay is a modern, full-stack HR and Payroll management platform designed for small to medium enterprises. It streamlines employee management, attendance tracking, leave requests, and payroll processing through an intuitive and premium user interface.

## 🎥 Video Demonstration
Explore the EmPay frontend in action:
[Watch Demo Video](https://drive.google.com/file/d/13S_uXGuEDjtgslG03BJJ85ax2QAeKoh7/view?usp=sharing)
---

## 📑 Table of Contents
- [In-Depth Overview](#-in-depth-overview)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [Security & Data Integrity](#-security--data-integrity)
- [User Roles & Permissions](#-user-roles--permissions)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Video Demonstration](#-video-demonstration)
- [Design Philosophy](#-design-philosophy)

---

## 🔍 In-Depth Overview
EmPay HRMS is engineered to solve the operational complexities of workforce management. Unlike standard HR tools, EmPay integrates **Payroll and Attendance** into a unified loop.
- **Attendance-Payroll Loop**: Attendance data (including half-days and leaves) is directly fed into the payroll engine to calculate accurate monthly payouts.
- **Relational Integrity**: Built on a highly normalized MySQL schema, ensuring that every financial transaction and leave deduction is traceable to a specific employee event.
- **Dynamic UX**: The frontend utilizes a state-driven architecture that ensures data (like leave balances) updates in real-time as administrative actions occur.

## ✨ Core Features

### 👥 Employee Management
- **Detailed Profiles**: Manage employee personal information, banking details, and salary parameters.
- **Mandatory Integrity**: Strict enforcement of financial data (PAN, Bank Acc, Wage) for payroll reliability.
- **Role Assignment**: Easily assign and update roles and departments.

### ⏱️ Attendance & Time Tracking
- **Real-time Logs**: Clean, segregated view of 'Present', 'Absent', and 'On Leave' statuses.
- **Smart Filtering**: Clickable status cards to instantly filter the organization's daily or monthly attendance.
- **Work Session Management**: Track check-ins, check-outs, and break durations.

### 🌴 Leave & Time Off
- **Dynamic Balances**: Real-time tracking of Annual, Sick, and Casual leave quotas.
- **Visual Progress**: Progress-bar based visualization of used vs. available leaves on employee profiles.
- **Approval Workflow**: Streamlined request submission and multi-role approval system.

### 💰 Payroll & Compensation
- **Automated Calculations**: Dynamic calculation of ESI, PF, and Professional Tax based on monthly wage.
- **Payslip Generation**: Generate professional, PDF-ready payslips with detailed earnings and deductions.
- **Financial Standards**: Enforced banking and tax field requirements to ensure payment accuracy.

---

## 🛠️ Tech Stack

### Frontend
- **React 19**: Modern UI component architecture.
- **Vite**: Ultra-fast build tool and development server.
- **Vanilla CSS**: Custom, high-performance design system with CSS Variables.
- **Recharts**: Interactive data visualization for the dashboard.
- **React Hot Toast**: Real-time feedback and notifications.

### Backend
- **Node.js & Express**: Scalable RESTful API architecture.
- **MySQL**: Relational database for structured and secure data storage.
- **JWT Authentication**: Secure, token-based session management.
- **Multer**: Robust handling of document uploads for leave requests.

---

## 🛡️ Security & Data Integrity
- **JWT (JSON Web Tokens)**: All API endpoints are protected via token-based authentication.
- **Bcrypt.js**: Passwords are never stored in plain text; they are hashed with a 10-round salt.
- **Input Sanitization**: Backend controllers strictly validate and sanitize all financial and personal inputs.
- **Role-Based Guards**: Fine-grained middleware ensures that sensitive salary data is only accessible to authorized roles (Admin, Payroll Officer).

---

## 🔐 User Roles & Permissions

- **Admin**: Full access to all modules, system settings, and user management.
- **HR Officer**: Manage employee profiles, attendance logs, and time-off requests.
- **Payroll Officer**: Specialized access to salary configurations, payslip generation, and financial reports.
- **Employee**: Personal dashboard to track attendance, apply for leave, and view/download payslips.

---

## 📁 Project Structure

```text
├── empay-frontend/       # React application (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components (Modals, Cards)
│   │   ├── pages/        # Main application views
│   │   ├── context/      # Auth & Global state management
│   │   └── utils/        # API wrappers and helpers
│   └── index.css         # Global design system & variables
│
├── empay-backend/        # Node.js Express API
│   ├── src/
│   │   ├── controllers/  # Business logic & DB queries
│   │   ├── routes/       # API endpoint definitions
│   │   ├── middleware/   # Auth & Role-based guards
│   │   └── db/           # Connection pool configuration
│   ├── server.js         # API Entry point
│   └── .env              # Environment variables
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MySQL Server

### 2. Database Setup
1. Create a database named `empay_db` (or as per your `.env`).
2. Run the provided SQL schema scripts.
3. Seed the data using `node seed-20.js` in the backend directory.

### 3. Backend Setup
```bash
cd empay-backend
npm install
npm run dev
```

### 4. Frontend Setup
```bash
cd empay-frontend
npm install
npm run dev
```

---

## 🎥 Video Demonstration
Explore the full capabilities of EmPay in our walkthrough video:

[![EmPay Project Walkthrough](https://img.shields.io/badge/Watch-Demo_Video-red?style=for-the-badge&logo=youtube)](YOUR_VIDEO_LINK_HERE)

> [!TIP]
> *Replace the placeholder link above with your actual YouTube or Loom demonstration video.*

---

## 🎨 Design Philosophy
EmPay follows a **Modern Corporate Aesthetic**:
- **Color Palette**: Sophisticated Slate and Navy tones with Primary Blue accents.
- **Typography**: Uses the 'Inter' font family for maximum readability.
- **Glassmorphism**: Subtle use of surface transparencies and shadows for depth.
- **Micro-animations**: Smooth transitions and hover effects for a premium feel.

---

*Built with ❤️ for efficient workforce management.*
