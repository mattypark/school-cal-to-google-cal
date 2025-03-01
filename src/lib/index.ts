// Services
export { AIService } from './ai-service';
export { CalendarService } from './calendar-service';
export { parseSchoolCalendar } from './calendar-parser';
export { getGoogleAuth } from './getGoogleAuth';

// Types
export type { ExtendedSession, ExtendedToken } from './auth';
export { authOptions } from './auth';

// Utilities
export { cn } from './utils';

// Constants and configurations
export const SUPPORTED_CALENDAR_FORMATS = [
  'School calendars',
  'Course schedules',
  'Event listings',
  'Conference schedules',
  'Class timetables'
] as const;

export const DEFAULT_TIMEZONE = 'America/New_York';

// Error messages
export const ERROR_MESSAGES = {
  NO_EVENTS_FOUND: 'No events found on the provided page. Please check the URL and try again.',
  AUTH_FAILED: 'Authentication failed. Please sign out and sign in again.',
  INVALID_URL: 'Please enter a valid URL',
  MISSING_TOKEN: 'Please sign in first',
  PARSING_FAILED: 'Failed to parse calendar data',
  API_ERROR: 'Failed to communicate with Google Calendar API'
} as const; 

const cheerio = require("cheerio") 

const url = "new"

async function getGenre() {
  try {
    const response = await fetch(url)
    const data = await response.text()

    const $ = cheerio.load(data)
    const genre = $("#default > div > div > div > div > div.page-header.action > h1")
  }catch (error) {
    console.error(error)
  }
}