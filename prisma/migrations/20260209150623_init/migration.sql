-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'INTERVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "InterviewerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('GUIDANCE', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'HR', 'MIXED');

-- CreateEnum
CREATE TYPE "HiringRecommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'WEAK_HIRE', 'NO_HIRE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "college" TEXT,
    "branch" TEXT,
    "graduation_year" INTEGER,
    "target_role" TEXT,
    "experience_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviewer_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "education" TEXT,
    "companies" TEXT[],
    "years_of_experience" INTEGER,
    "roles_supported" TEXT[],
    "difficulty_levels" "DifficultyLevel"[],
    "session_types_offered" "SessionType"[],
    "linkedin_url" TEXT,
    "status" "InterviewerStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviewer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" SERIAL NOT NULL,
    "interviewer_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "interviewer_id" INTEGER NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "topic" TEXT,
    "role" TEXT,
    "difficulty" "DifficultyLevel",
    "interview_type" "InterviewType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "interviewer_id" INTEGER NOT NULL,
    "summary" TEXT,
    "strengths" TEXT,
    "recommendations" TEXT,
    "action_items" TEXT,
    "technical_depth" INTEGER,
    "problem_solving" INTEGER,
    "communication" INTEGER,
    "confidence" INTEGER,
    "overall_comments" TEXT,
    "hiring_recommendation" "HiringRecommendation",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "interviewer_profiles_user_id_key" ON "interviewer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_session_id_key" ON "feedback"("session_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviewer_profiles" ADD CONSTRAINT "interviewer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "interviewer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "interviewer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "interviewer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
