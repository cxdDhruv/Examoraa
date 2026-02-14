# 🔒 SecureExam — AI-Driven Secure Online Examination System

A full-stack, production-ready online examination platform with **real-time proctoring**, **webcam monitoring**, **anti-cheat engine**, **auto-grading**, and **live WebSocket monitoring**.

---

## ✨ Features

### 🛡️ Anti-Cheat Engine
- **Tab switching detection** with configurable limits
- **Copy/Paste/Right-click blocking**
- **Keyboard shortcut interception** (Ctrl+C/V/X/A, F12, Alt+Tab, PrintScreen)
- **Fullscreen enforcement** with exit detection
- **DevTools blocking** (F12, Ctrl+Shift+I/J/C)
- **Window resize/blur detection**
- **Automatic exam cancellation** on excessive violations

### 📷 Webcam Proctoring
- Live webcam feed during exam
- **Periodic snapshot capture** every 30 seconds
- Camera access denial detection & logging

### ⚡ Auto-Grading
- Instant scoring for **Multiple Choice** and **True/False** questions
- Percentage calculation with pass/fail determination
- Manual grading support for **Short Answer** questions

### 📊 Live Monitoring (WebSocket)
- Real-time **violation alerts** for instructors
- **Exam start/submit notifications**
- Active attempt tracking with violation counts
- Live alert feed with timestamps

### 🔐 Authentication & Authorization
- JWT-based authentication with bcrypt password hashing
- **Role-based access** (Student, Instructor, Admin)
- Protected API routes with middleware

### 📝 Exam Management
- Full CRUD for exams with question builder
- Support for MCQ, True/False, Short Answer
- Per-exam anti-cheat settings configuration
- Publish/Draft toggle

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 7 |
| **Styling** | Custom CSS (Dark Theme, Glassmorphism) |
| **Icons** | Lucide React |
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Real-time** | Socket.io |
| **Auth** | JWT + bcryptjs |
| **Security** | Helmet, Rate Limiting, CORS |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **MongoDB** (local or Atlas)

### 1. Clone & Install Backend
```bash
cd secure-exam-system
cp .env.example .env     # Edit with your MongoDB URI
npm install
```

### 2. Install Frontend
```bash
cd client
npm install
```

### 3. Start Development
```bash
# Terminal 1 — Backend (from /secure-exam-system)
npm run dev

# Terminal 2 — Frontend (from /secure-exam-system/client)
npm run dev
```

### 4. Open
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login & get JWT |
| GET | `/api/auth/me` | Get current user |

### Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exams` | List exams |
| POST | `/api/exams` | Create exam (instructor) |
| PUT | `/api/exams/:id` | Update exam |
| DELETE | `/api/exams/:id` | Delete exam |
| POST | `/api/exams/:id/start` | Start exam (student) |
| GET | `/api/exams/:id/attempts` | Get attempts (instructor) |

### Attempts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attempts/:id/answer` | Save answer |
| POST | `/api/attempts/:id/submit` | Submit exam |
| POST | `/api/attempts/:id/violation` | Log violation |
| POST | `/api/attempts/:id/snapshot` | Save webcam snapshot |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/student` | Student stats |
| GET | `/api/dashboard/instructor` | Instructor dashboard |

---

## 🔧 Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure-exam-system
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_TAB_SWITCH_LIMIT=3
SNAPSHOT_INTERVAL_SECONDS=30
```

---

## 📁 Project Structure

```
secure-exam-system/
├── server.js              # Express + MongoDB + Socket.io backend
├── package.json           # Backend dependencies
├── .env                   # Environment variables
├── .env.example
├── .gitignore
└── client/                # React frontend
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx                    # Auth, Routing, Landing
        ├── index.css                  # Premium dark theme
        └── components/
            ├── SecureExamSystem.jsx    # Student anti-cheat exam UI
            └── AdminDashboard.jsx     # Instructor dashboard
```

---

## 🎨 Features by Role

### Student
- Browse & start available exams
- Take exam with anti-cheat protections active
- View results and history
- Webcam monitoring during exam

### Instructor
- Create exams with question builder
- Configure anti-cheat settings per exam
- View all attempts with violation details
- Live monitoring via WebSocket
- Receive real-time violation alerts

### Admin
- Full instructor capabilities
- System-wide oversight

---

## 📄 License

MIT
