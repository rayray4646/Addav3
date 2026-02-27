export interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  occupation?: string; // "Department · Year"
  location?: string;   // University name
  interests?: string[]; // prefixed: vibe:, activity:, looking:, spot:, avail:, social:, color:
  bio?: string;
  created_at?: string;
  updated_at?: string;
  role?: 'general' | 'admin';
  // Gamification (updated by DB triggers)
  streak_days?: number;
  adda_count?: number;
  hosted_count?: number;
  last_hangout_date?: string;
}

export interface Hangout {
  participant_previews?: { name: string; avatar_url: string | null }[];
  id: string;
  creator_id: string;
  activity_type: string;
  title: string;
  location_text: string;
  start_time: string;
  max_participants: number;
  created_at: string;
  expires_at: string;
  participant_count?: number; // Computed
  my_status?: 'pending' | 'approved' | 'rejected' | null; // Computed for current user
  creator?: Profile; // Joined data
}

export interface Participant {
  id: string;
  hangout_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  joined_at: string;
  user?: Profile; // Joined data
}

export interface Message {
  id: string;
  hangout_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: Profile; // Joined data
  message_type: 'text' | 'image';
  media_url?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'join_request' | 'approved' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export type ActivityType = 'Study' | 'Coffee' | 'Walk' | 'Sports' | 'Food' | 'Other';

export const ACTIVITY_TYPES: ActivityType[] = ['Study', 'Coffee', 'Walk', 'Sports', 'Food', 'Other'];

export const ACTIVITY_EMOJIS: Record<string, string> = {
  'Study': '📚',
  'Coffee': '☕',
  'Walk': '🚶',
  'Sports': '⚽',
  'Food': '🍔',
  'Other': '🎉'
};

export const TIME_OPTIONS = [
  { label: 'Now', minutes: 0 },
  { label: 'In 30m', minutes: 30 },
  { label: 'In 1h', minutes: 60 },
  { label: 'Tonight', minutes: -1 }, // Special handling
  { label: 'Tomorrow', minutes: -2 }, // Special handling
];

// Onboarding Constants
export const VIBES = [
  { label: 'Chai Addict', emoji: '☕' },
  { label: 'Night Owl', emoji: '🌙' },
  { label: 'Early Bird', emoji: '🌅' },
  { label: 'Library Ghost', emoji: '📚' },
  { label: 'Gym Rat', emoji: '🏋️' },
  { label: 'Social Butterfly', emoji: '🎉' },
  { label: 'Music Head', emoji: '🎧' },
  { label: 'Foodie', emoji: '🍕' },
  { label: 'Tech Nerd', emoji: '💻' },
];

export const ACTIVITIES = [
  { label: 'Coffee', emoji: '☕', desc: 'Casual meetups' },
  { label: 'Study', emoji: '📚', desc: 'Focus sessions' },
  { label: 'Sports', emoji: '🏃', desc: 'Active hangouts' },
  { label: 'Walk', emoji: '🚶', desc: 'Strolls & talks' },
  { label: 'Food', emoji: '🍔', desc: 'Eating together' },
  { label: 'Gaming', emoji: '🎮', desc: 'Co-op & chill' },
  { label: 'Music', emoji: '🎵', desc: 'Jam & explore' },
  { label: 'Creative', emoji: '🎨', desc: 'Art & making' },
  { label: 'Outdoor', emoji: '🌿', desc: 'Parks & nature' },
];

export const LOOKING_FOR = [
  { label: 'Study buddy', emoji: '📖', desc: 'Regular study partner' },
  { label: 'Workout partner', emoji: '💪', desc: 'Gym or sports crew' },
  { label: 'Chai friend', emoji: '☕', desc: 'Someone to talk to' },
  { label: 'Meal companion', emoji: '🍽️', desc: 'Eat together' },
  { label: 'New friends', emoji: '🤝', desc: 'Expand my circle' },
  { label: 'Skill swap', emoji: '🧠', desc: 'Teach and learn' },
];

export const CAMPUS_SPOTS = [
  'TSC Canteen', 'Library', 'Starbase GYM', 'Third Place', 'Rooftop', 
  'Cafeteria', 'Study Hall', 'Football Field', 'Basketball Court', 
  'Auditorium', 'Student Lounge', 'Lab', 'Garden', 'Mosque'
];

export interface UserStats {
  adda_count: number;
  hosted_count: number;
  streak_days: number;
}

export function getRepTier(addaCount: number): { name: string; next: string; color: string; emoji: string } {
  if (addaCount >= 25) return { name: 'Campus Legend', next: '', color: 'text-orange', emoji: '🏆' };
  if (addaCount >= 10) return { name: 'Connector', next: 'Campus Legend at 25', color: 'text-teal', emoji: '🔗' };
  if (addaCount >= 3)  return { name: 'Regular', next: 'Connector at 10', color: 'text-green', emoji: '⭐' };
  return { name: 'Starter', next: 'Regular at 3 addas', color: 'text-mid', emoji: '🌱' };
}
