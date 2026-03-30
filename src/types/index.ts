// Define enums locally instead of importing from Prisma client
export type UserRole = 'STUDENT' | 'INTERVIEWER' | 'ADMIN';
export type InterviewerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SessionType = 'GUIDANCE' | 'INTERVIEW';
export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type InterviewType = 'TECHNICAL' | 'HR' | 'MIXED';
export type HiringRecommendation = 'STRONG_HIRE' | 'HIRE' | 'WEAK_HIRE' | 'NO_HIRE';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  role: 'STUDENT' | 'INTERVIEWER';
}

export interface StudentProfileData {
  name: string;
  college?: string;
  branch?: string;
  graduationYear?: number;
  targetRole?: string;
  experienceLevel?: string;
}

export interface InterviewerProfileData {
  name: string;
  education?: string;
  companies: string[];
  yearsOfExperience?: number;
  rolesSupported: string[];
  difficultyLevels: DifficultyLevel[];
  sessionTypesOffered: SessionType[];
  linkedinUrl?: string;
}

export interface BookGuidanceRequest {
  interviewerId: number;
  topic: string;
  durationMinutes: number;
  scheduledTime: string;
}

export interface BookInterviewRequest {
  role: string;
  difficulty: DifficultyLevel;
  interviewType: InterviewType;
  durationMinutes: number;
  scheduledTime: string;
}

export interface AvailabilitySlotData {
  startTime: string;
  endTime: string;
}

export interface GuidanceFeedbackData {
  summary: string;
  strengths: string;
  recommendations: string;
  actionItems: string;
}

export interface InterviewFeedbackData {
  summary: string;
  technicalDepth: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  overallComments: string;
  hiringRecommendation: HiringRecommendation;
}