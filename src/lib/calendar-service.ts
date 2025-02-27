import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}

export class CalendarService {
  private static async getOAuthClient(accessToken: string) {
    try {
      console.log('Creating OAuth client with token:', accessToken.substring(0, 10) + '...')
      
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Missing Google OAuth credentials')
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      )
      
      oauth2Client.setCredentials({
        access_token: accessToken,
        token_type: 'Bearer'
      })
      
      return oauth2Client
    } catch (error) {
      console.error('Error creating OAuth client:', error)
      throw new Error('Failed to create OAuth client: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  static async addEvent(accessToken: string, event: CalendarEvent) {
    try {
      if (!accessToken) {
        throw new Error('No access token provided')
      }

      const auth = await this.getOAuthClient(accessToken)
      
      // Verify the token is valid
      try {
        console.log('Verifying token validity...')
        const tokenInfo = await auth.getTokenInfo(accessToken)
        console.log('Token info:', tokenInfo)
      } catch (error) {
        console.error('Invalid token:', error)
        throw new Error('Invalid or expired token. Please sign out and sign in again.')
      }

      console.log('Creating Google Calendar client...')
      const calendar = google.calendar({ 
        version: 'v3', 
        auth
      })
      
      const eventData = {
        summary: event.summary,
        description: event.description || '',
        location: event.location || '',
        start: {
          dateTime: event.start.dateTime,
          timeZone: event.start.timeZone || 'America/New_York'
        },
        end: {
          dateTime: event.end.dateTime,
          timeZone: event.end.timeZone || 'America/New_York'
        },
        recurrence: event.recurrence,
        reminders: {
          useDefault: true
        },
        transparency: 'opaque', // Show as busy
        visibility: 'default'
      }
      
      console.log('Adding event with data:', JSON.stringify(eventData, null, 2))
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventData,
      })

      if (!response.data) {
        throw new Error('No response data from Google Calendar API')
      }

      console.log('Event added successfully:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Error adding event:', error.response?.data || error)
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please sign out and sign in again.')
      }
      
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to add event'
      console.error('Detailed error:', errorMessage)
      throw new Error(errorMessage)
    }
  }

  static async batchAddEvents(accessToken: string, events: CalendarEvent[]) {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { event: string; error: string }[]
    };

    for (const event of events) {
      try {
        await this.addEvent(accessToken, event);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          event: event.summary,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}