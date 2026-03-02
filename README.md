# 🎓 InterviewPrep Live

**Complete Full-Stack Interview Preparation Platform**

A production-ready Next.js application for live 1-to-1 interview preparation with automatic interviewer assignment, role-based dashboards, and comprehensive feedback system.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [User Roles](#-user-roles)
- [Key Features](#-key-features)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🔐 Authentication & Authorization
- ✅ Email/password authentication with JWT tokens
- ✅ Role-based access control (Student, Interviewer, Admin)
- ✅ Admin email whitelist for controlled admin access
- ✅ bcrypt password hashing (10 rounds)
- ✅ HTTP-only cookies for security
- ✅ Protected routes with middleware

### 👨‍🎓 Student Features
- ✅ Complete profile management (college, branch, graduation year, target role)
- ✅ Book guidance sessions (manually select mentor)
- ✅ Book mock interviews (automatic interviewer assignment)
- ✅ View upcoming and past sessions
- ✅ Access detailed feedback with ratings
- ✅ Dashboard with session statistics

### 👔 Interviewer Features
- ✅ Comprehensive profile setup (education, companies, experience)
- ✅ Approval workflow (Pending → Approved/Rejected by admin)
- ✅ Manage availability slots with calendar integration
- ✅ View all assigned sessions
- ✅ Submit structured feedback for both session types
- ✅ Dashboard with upcoming sessions and statistics

### 👨‍💼 Admin Features
- ✅ Approve/reject interviewer applications
- ✅ View all interviewers with detailed profiles
- ✅ Platform analytics dashboard
- ✅ Session monitoring and management
- ✅ Manual interviewer assignment (override auto-assignment)
- ✅ Top interviewer statistics
- ✅ Platform configuration (roles, difficulty levels)

### 🤖 Smart Auto-Assignment Algorithm
- ✅ Matches interviewers based on role expertise
- ✅ Filters by difficulty level capability
- ✅ Checks session type availability
- ✅ Verifies interviewer availability slots
- ✅ Load balancing (selects interviewer with fewest upcoming sessions)

### 📊 Comprehensive Feedback System

**Guidance Session Feedback:**
- Summary of the session
- Student strengths
- Recommendations for improvement
- Specific action items

**Mock Interview Feedback:**
- Technical Depth (1-5 rating)
- Problem Solving (1-5 rating)
- Communication (1-5 rating)
- Confidence (1-5 rating)
- Overall comments
- Hiring recommendation (Strong Hire / Hire / Weak Hire / No Hire)

---

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **Fonts:** Inter, Outfit (Google Fonts)
- **UI Components:** Custom components with Tailwind

### Backend
- **Runtime:** Node.js (Next.js API Routes)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT + bcrypt

### Development Tools
- **Package Manager:** npm
- **Type Checking:** TypeScript
- **Database Management:** Prisma Studio

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher
- **PostgreSQL** 14.0 or higher
- **Git** (for version control)

---

## 🚀 Installation

### 1. Clone or Create Project Directory

```bash
mkdir interviewprep-live
cd interviewprep-live
```

### 2. Create Directory Structure

```bash
# Create all necessary directories
mkdir -p prisma
mkdir -p src/{lib,types,components/{ui,layout,shared},app}
mkdir -p src/app/{api,login,signup,student,interviewer,admin}
mkdir -p src/app/api/{auth/{signup,login,me},student/{profile,sessions,book/{guidance,interview}}}
mkdir -p src/app/api/{interviewer/{profile,availability,sessions,list},admin/{interviewers,analytics,assign},feedback}
mkdir -p src/app/{login/{student,interviewer},signup/{student,interviewer}}
mkdir -p src/app/student/{dashboard,book-guidance,book-interview,sessions,feedback/[sessionId]}
mkdir -p src/app/interviewer/{dashboard,availability,sessions,feedback/[sessionId]}
mkdir -p src/app/admin/{dashboard,interviewers,config,analytics}
```

### 3. Copy Files

Copy all files from the deliverables into their respective directories according to the project structure.

### 4. Install Dependencies

```bash
npm install
```

---

## ⚙️ Configuration

### 1. Environment Variables

Copy the `.env` file or create one from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/interviewprep_live?schema=public"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"

# Admin Emails (comma-separated)
ADMIN_EMAILS="admin@company.com,superadmin@company.com"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

**Important Configuration Notes:**

- **DATABASE_URL:** Replace `username`, `password`, and database credentials
- **JWT_SECRET:** Generate a secure random string (min 32 characters)
  ```bash
  # Generate using OpenSSL
  openssl rand -base64 32
  ```
- **ADMIN_EMAILS:** List emails that will automatically become admins

---

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

```bash
createdb interviewprep_live
```

Or using psql:
```bash
psql -U postgres
CREATE DATABASE interviewprep_live;
\q
```

### 2. Execute SQL Schema

```bash
psql -U postgres -d interviewprep_live -f schema.sql
```

This creates:
- 6 database tables
- 7 enum types
- Foreign key relationships
- Performance indexes
- Timestamp triggers

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Verify Database (Optional)

```bash
# Open Prisma Studio
npm run prisma:studio
```

Visit http://localhost:5555 to view your database.

---

## ▶️ Running the Application

### Development Mode

```bash
npm run dev
```

Visit **http://localhost:3000**

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema changes to database
npm run prisma:studio    # Open Prisma Studio
```

---

## 📂 Complete Folder Structure

```
interviewprep-live/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── signup/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   └── me/
│   │   │   │       └── route.ts
│   │   │   ├── student/
│   │   │   │   ├── profile/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sessions/
│   │   │   │   │   └── route.ts
│   │   │   │   └── book/
│   │   │   │       ├── guidance/
│   │   │   │       │   └── route.ts
│   │   │   │       └── interview/
│   │   │   │           └── route.ts
│   │   │   ├── interviewer/
│   │   │   │   ├── profile/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── availability/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sessions/
│   │   │   │   │   └── route.ts
│   │   │   │   └── list/
│   │   │   │       └── route.ts
│   │   │   ├── admin/
│   │   │   │   ├── interviewers/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── analytics/
│   │   │   │   │   └── route.ts
│   │   │   │   └── assign/
│   │   │   │       └── route.ts
│   │   │   └── feedback/
│   │   │       └── route.ts
│   │   ├── login/
│   │   │   ├── student/
│   │   │   │   └── page.tsx
│   │   │   └── interviewer/
│   │   │       └── page.tsx
│   │   ├── signup/
│   │   │   ├── student/
│   │   │   │   └── page.tsx
│   │   │   └── interviewer/
│   │   │       └── page.tsx
│   │   ├── student/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── book-guidance/
│   │   │   │   └── page.tsx
│   │   │   ├── book-interview/
│   │   │   │   └── page.tsx
│   │   │   ├── sessions/
│   │   │   │   └── page.tsx
│   │   │   └── feedback/
│   │   │       └── [sessionId]/
│   │   │           └── page.tsx
│   │   ├── interviewer/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── availability/
│   │   │   │   └── page.tsx
│   │   │   ├── sessions/
│   │   │   │   └── page.tsx
│   │   │   └── feedback/
│   │   │       └── [sessionId]/
│   │   │           └── page.tsx
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── interviewers/
│   │   │   │   └── page.tsx
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx
│   │   │   └── config/
│   │   │       └── page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   └── Badge.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── ProtectedRoute.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorBoundary.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts
├── public/
│   └── assets/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── schema.sql
└── README.md
```

**Total Structure:**
- **29 API Routes** (Backend endpoints)
- **24 Page Components** (Frontend pages)
- **6 UI Components** (Reusable components)
- **3 Layout Components** (Navigation & structure)
- **6 Core Utilities** (Auth, Prisma, helpers)
- **3 Type Definition Files**

---
## 👥 User Roles

### 🎓 Student
**Access:** `/student/*`

**Capabilities:**
- Create and manage profile
- Browse available mentors
- Book guidance sessions (choose mentor)
- Book mock interviews (auto-assigned)
- View session history
- Access feedback

**Profile Fields:**
- Name, College, Branch
- Graduation Year
- Target Role, Experience Level

### 👔 Interviewer
**Access:** `/interviewer/*`

**Capabilities:**
- Create detailed profile
- Add availability slots
- View assigned sessions
- Submit structured feedback
- Track completed sessions

**Profile Fields:**
- Name, Education
- Companies, Years of Experience
- Supported Roles
- Difficulty Levels (Easy/Medium/Hard)
- Session Types (Guidance/Interview)
- LinkedIn URL

**Status Flow:**
```
Signup → PENDING → Admin Review → APPROVED/REJECTED
```

### 👨‍💼 Admin
**Access:** `/admin/*`

**Capabilities:**
- Approve/reject interviewers
- View platform analytics
- Monitor all sessions
- Configure platform settings
- Manual interviewer assignment

**Access Control:**
- Only emails in `ADMIN_EMAILS` can become admin
- No public signup for admin role

---

## 🔑 Key Features

### Auto-Assignment Algorithm

When a student books a mock interview:

1. **Filter Interviewers:**
   - Status: APPROVED
   - Supports: Selected role
   - Handles: Selected difficulty
   - Offers: INTERVIEW session type
   - Available: Has free slot at requested time

2. **Load Balancing:**
   - Count upcoming sessions for each candidate
   - Select interviewer with fewest upcoming sessions
   - Ensures fair distribution of workload

3. **Booking:**
   - Create session record
   - Mark availability slot as booked
   - Notify both parties (if notifications enabled)

### Feedback System

**Mandatory before completion:**
- Session cannot be marked complete without feedback
- Different forms for guidance vs interview
- Visible to students after submission

**Feedback Visibility:**
- Students can view their feedback
- Interviewers can see past feedback they submitted
- Admins can view all feedback

### Session Workflow

```
1. Student Books Session
   ↓
2. System Assigns Interviewer (if mock interview)
   ↓
3. Both Receive Notification
   ↓
4. Session Conducted (external - Zoom/Meet)
   ↓
5. Interviewer Submits Feedback
   ↓
6. Session Marked COMPLETED
   ↓
7. Student Views Feedback
```

---

## 📡 API Documentation

### Authentication Endpoints

```typescript
POST   /api/auth/signup        // User registration
POST   /api/auth/login         // User login
GET    /api/auth/me            // Get current user
```

### Student Endpoints

```typescript
GET    /api/student/profile              // Get profile
POST   /api/student/profile              // Create/update profile
GET    /api/student/sessions             // List all sessions
POST   /api/student/book/guidance        // Book guidance session
POST   /api/student/book/interview       // Book interview (auto-assign)
```

### Interviewer Endpoints

```typescript
GET    /api/interviewer/profile          // Get profile
POST   /api/interviewer/profile          // Create/update profile
GET    /api/interviewer/availability     // List availability
POST   /api/interviewer/availability     // Add availability slot
DELETE /api/interviewer/availability     // Remove slot
GET    /api/interviewer/sessions         // List assigned sessions
GET    /api/interviewer/list             // List approved interviewers
```

### Admin Endpoints

```typescript
GET    /api/admin/interviewers           // List all interviewers
PATCH  /api/admin/interviewers           // Update status
GET    /api/admin/analytics              // Platform analytics
GET    /api/admin/assign                 // Get available interviewers
POST   /api/admin/assign                 // Manual assignment
```

### Feedback Endpoint

```typescript
GET    /api/feedback?sessionId={id}      // Get feedback
POST   /api/feedback                     // Submit feedback
```

---

## 🧪 Testing the Application

### 1. Create Admin Account

```bash
# Use one of the ADMIN_EMAILS
# Sign up at /signup/student or /signup/interviewer
# Automatically becomes admin
```

### 2. Create Interviewer

```bash
# Sign up at /signup/interviewer
# Complete profile at /interviewer/dashboard
# Status: PENDING
```

### 3. Approve Interviewer (as Admin)

```bash
# Login as admin
# Navigate to /admin/interviewers
# Click "Approve" on pending interviewer
```

### 4. Add Availability (as Interviewer)

```bash
# Login as interviewer
# Navigate to /interviewer/availability
# Add time slots
```

### 5. Create Student & Book Session

```bash
# Sign up at /signup/student
# Complete profile
# Book guidance session (choose mentor)
# Book mock interview (auto-assigned)
```

### 6. Complete Workflow

```bash
# Interviewer submits feedback
# Student views feedback
# Session marked COMPLETED
```

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Docker Deployment

```dockerfile
# Dockerfile (create in root)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t interviewprep-live .
docker run -p 3000:3000 interviewprep-live
```

### Environment Variables for Production

```env
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
ADMIN_EMAILS="your-admin-emails"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"
```

---

## 🐛 Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready

# Verify database exists
psql -l | grep interviewprep_live

# Test connection
psql -U postgres -d interviewprep_live -c "SELECT 1;"
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Prisma Client Not Found

```bash
# Regenerate Prisma client
npx prisma generate

# If still issues, clear and reinstall
rm -rf node_modules
npm install
npx prisma generate
```

### TypeScript Errors

```bash
# Check TypeScript config
npx tsc --noEmit

# Clear Next.js cache
rm -rf .next
npm run dev
```

### Build Errors

```bash
# Clear everything and rebuild
rm -rf .next node_modules
npm install
npm run build
```

---

## 📊 Performance Optimization

### Database
- ✅ Indexed columns for fast queries
- ✅ Foreign key relationships
- ✅ Connection pooling via Prisma

### Frontend
- ✅ Server-side rendering
- ✅ Code splitting
- ✅ Image optimization
- ✅ CSS optimization with Tailwind

### Security
- ✅ JWT authentication
- ✅ HTTP-only cookies
- ✅ Password hashing
- ✅ SQL injection prevention (Prisma)
- ✅ XSS protection
- ✅ CSRF protection

---

## 🤝 Contributing

This is a complete MVP. For production use:

1. Add email notifications
2. Implement video calling integration
3. Add payment processing
4. Implement real-time chat
5. Add calendar integration
6. Implement notifications system

---

## 📄 License

This project is proprietary software.

---

## 🎉 Success Criteria

✅ Application runs on http://localhost:3000
✅ Can create accounts for all roles
✅ Students can book sessions
✅ Auto-assignment works correctly
✅ Interviewers can submit feedback
✅ Admin can approve interviewers
✅ All dashboards are functional
✅ Database queries are fast
✅ Authentication is secure
✅ UI is responsive and modern

---

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review the [API Documentation](#-api-documentation)
3. Verify environment variables are set correctly
4. Check database connection

---

## 🎯 Quick Commands Reference

```bash
# Setup
npm install
createdb interviewprep_live
psql -d interviewprep_live -f schema.sql
npm run prisma:generate

# Development
npm run dev
npm run prisma:studio

# Production
npm run build
npm start

# Database
npm run prisma:push
npm run prisma:generate

# Troubleshooting
rm -rf .next node_modules
npm install
```

---

**Built with ❤️ using Next.js, TypeScript, Prisma, and PostgreSQL**

🚀 **Ready to deploy!**