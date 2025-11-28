
export type Language = 'en' | 'zh';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  // password removed: never store or type raw passwords in the client User object
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
  PROFILE = 'PROFILE'
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  unlocked: boolean;
  description: string;
}
