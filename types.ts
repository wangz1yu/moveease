
export type Language = 'en' | 'zh';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Exercise {
  id: string;
  name: string;
  duration: number; // in seconds
  category: 'neck' | 'waist' | 'eyes' | 'fullbody' | 'shoulders';
  description: string;
  imageUrl: string;
}

export interface DailyStat {
  day: string;
  sedentaryHours: number;
  activeBreaks: number;
}

export interface UserStats {
  totalWorkouts: number;
  currentStreak: number;
  lastWorkoutDate: string | null; // "YYYY-MM-DD"
}

export interface Quote {
  en: string;
  zh: string;
}

export interface DNDSchedule {
  id: string;
  label: string; // e.g., "Lunch Break"
  startTime: string; // "HH:mm" 24h format
  endTime: string;   // "HH:mm" 24h format
  isEnabled: boolean;
}

export interface DNDSettings {
  schedules: DNDSchedule[];
  calendarSync: boolean; // "Busy" status detection
  smartDetection: boolean; // AI habit learning
}

export interface UserSettings {
  sedentaryThreshold: number; // minutes
  doNotDisturb: DNDSettings;
  notificationsEnabled: boolean;
  language: Language;
}

export enum AppView {
  HOME = 'HOME',
  WORKOUTS = 'WORKOUTS',
  STATS = 'STATS',
  PROFILE = 'PROFILE',
  LIFELOG = 'LIFELOG' // New View
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  unlocked: boolean;
  description: string;
}

export interface Announcement {
  id: string;
  title: string;
  created_at: string; // From DB timestamp
  content: string;
}

// --- LifeLog Types ---
export type MoodType = 'happy' | 'calm' | 'sad' | 'angry' | 'anxious';

export interface MoodConfig {
  id: MoodType;
  label: string;
  color: string; // Hex
  icon: string; // Emoji
}

export interface LifeLog {
  id: string;
  user_id: string;
  content: string;
  mood: MoodType;
  created_at: string; // ISO String
}
