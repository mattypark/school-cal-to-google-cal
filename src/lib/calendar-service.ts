import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export class CalendarService {
  private static async getOAuthClient(accessToken: string) {
    try {
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
      throw error
    }
  }

  static async addEvent(accessToken: string, event: any) {
    try {
      if (!accessToken) {
        throw new Error('No access token provided')
      }

      const auth = await this.getOAuthClient(accessToken)
      
      // Verify the token is valid
      try {
        const tokenInfo = await auth.getTokenInfo(accessToken)
        console.log('Token info:', tokenInfo)
      } catch (error) {
        console.error('Invalid token:', error)
        throw new Error('Invalid or expired token')
      }

      const calendar = google.calendar({ 
        version: 'v3', 
        auth,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      
      console.log('Adding event with data:', {
        summary: event.summary,
        start: event.start,
        end: event.end
      })
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.summary,
          description: event.description || '',
          start: {
            dateTime: event.start.dateTime,
            timeZone: event.start.timeZone || 'America/New_York'
          },
          end: {
            dateTime: event.end.dateTime,
            timeZone: event.end.timeZone || 'America/New_York'
          }
        },
      })

      console.log('Event added successfully:', response.data)
      return response.data
    } catch (error: any) {
      console.error('Error adding event:', error.response?.data || error)
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please sign out and sign in again.')
      }
      throw error
    }
  }
}