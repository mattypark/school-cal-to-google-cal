import { google } from 'googleapis'

export class CalendarService {
  private static async getOAuthClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      access_token: accessToken
    })
    
    return oauth2Client
  }

  static async addEvent(accessToken: string, event: any) {
    try {
      const auth = await this.getOAuthClient(accessToken)
      const calendar = google.calendar({ version: 'v3', auth })
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      })
      
      return response.data
    } catch (error) {
      console.error('Error adding event:', error)
      throw error
    }
  }
}