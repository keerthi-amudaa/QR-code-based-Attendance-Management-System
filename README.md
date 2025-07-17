# 🎓 Student Attendance Tracker and Viewer

A modern, secure, and efficient web-based attendance system built using **QR codes, Geofencing, and WiFi authentication**. Designed for educational institutions, this full-stack project ensures accurate attendance tracking and seamless access to academic resources for both students and teachers.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Screenshots](#-screenshots)
- [Setup Instructions](#-setup-instructions)
- [Future Scope](#-future-scope)
- [Team](#-team)

---

## 🔍 Overview

Traditional attendance systems are error-prone, time-consuming, and vulnerable to proxy attendance. This project solves those issues by leveraging:
- **QR Code-based attendance**
- **Geofencing for location verification**
- **WiFi-based authentication** to ensure students are physically present on campus

It supports **role-based dashboards** for:
- 👨‍🏫 **Teachers**: Generate QR codes, manage resources, view attendance reports
- 🎓 **Students**: Scan QR, view attendance, access study materials

---

## 🚀 Key Features

✅ **Secure QR Code Generation & Scanning**  
✅ **Location & WiFi Authentication**  
✅ **Role-based Authentication (JWT)**  
✅ **Real-time Attendance Reports**  
✅ **Responsive Student & Teacher Dashboards**  
✅ **Resource Uploads (PDFs, PPTs)**  
✅ **Scalable NoSQL (MongoDB) Backend**

---

## 🛠 Tech Stack

| Layer       | Technology                           |
|-------------|--------------------------------------|
| Frontend    | React.js, Tailwind CSS               |
| Backend     | Node.js, Express.js, FastAPI         |
| Database    | MongoDB (NoSQL)                      |
| Auth        | JWT (JSON Web Tokens)                |
| Dev Tools   | VS Code, Postman, Swagger UI         |

---

## 🧠 System Architecture

- **Frontend** (React):
  - Dynamic forms, QR scanner, dashboards
- **Backend** (Node.js + FastAPI):
  - QR generation, authentication, attendance logic
- **MongoDB**:
  - Stores user info, attendance logs, resources
- **Validation**:
  - Checks geolocation & WiFi network before marking attendance

---

## 🖼️ Screenshots

> _(*Add actual screenshots in the GitHub repo using `![](/path/to/image)` syntax)*_

- ✅ Teacher Dashboard
- 📱 QR Code Scanner Interface
- 📊 Attendance Report View
- 📂 Resource Upload & Access

---

## ⚙️ Setup Instructions

```bash
# Clone the repository
git clone https://github.com/keerthi-amudaa/QR-code-based-Attendance-Management-System.git

# Navigate to frontend and install dependencies
cd frontend
npm install
npm start

# In another terminal, navigate to backend and start the server
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
