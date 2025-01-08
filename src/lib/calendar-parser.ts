import axios from 'axios'
import * as cheerio from 'cheerio'

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
}

export async function parseSchoolCalendar(url: string): Promise<CalendarEvent[]> {
  try {
    console.log('Fetching URL:', url)
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const events: CalendarEvent[] = []

    // SOMS specific selectors
    // Looking for events in the main content area
    $('.upcoming-events, .events-list, #calendar, .calendar').find('.event, .calendar-event, .event-item').each((_, element) => {
      console.log('Found event element:', $(element).text()) // Debug log
      
      const title = $(element).find('.event-title, .title, h3').text().trim()
      const dateText = $(element).find('.event-date, .date, time').text().trim()
      const description = $(element).find('.event-description, .description').text().trim()

      console.log('Parsed event:', { title, dateText, description }) // Debug log

      if (title || dateText) {
        const eventDate = parseEventDate(dateText)
        if (eventDate) {
          events.push({
            summary: title || dateText,
            description: description,
            start: {
              dateTime: eventDate.toISOString(),
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
              timeZone: 'America/New_York',
            },
          })
        }
      }
    })

    // Try alternative selectors for SOMS
    if (events.length === 0) {
      console.log('Trying alternative selectors') // Debug log
      
      // Look for any list items that might contain dates
      $('li').each((_, element) => {
        const text = $(element).text().trim()
        console.log('Checking list item:', text) // Debug log
        
        // Look for date patterns in the text
        const dateMatch = text.match(/(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i)
        if (dateMatch) {
          const eventDate = parseEventDate(dateMatch[0])
          if (eventDate) {
            events.push({
              summary: text,
              start: {
                dateTime: eventDate.toISOString(),
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                timeZone: 'America/New_York',
              },
            })
          }
        }
      })
    }

    // Try to find any dates on the page
    if (events.length === 0) {
      $('*').each((_, element) => {
        const text = $(element).text().trim()
        if (text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)) {
          console.log('Found potential date text:', text) // Debug log
        }
      })
    }

    console.log('Total events found:', events.length) // Debug log
    return events
  } catch (error) {
    console.error('Error parsing calendar:', error)
    throw new Error('Failed to parse calendar data')
  }
}

function parseEventDate(dateText: string): Date | null {
  try {
    // Common date formats
    const formats = [
      // January 1, 2024
      /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i,
      // 1/1/2024
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // 2024-01-01
      /(\d{4})-(\d{2})-(\d{2})/,
      // Monday, January 1
      /(?:\w+,\s*)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i
    ]

    for (const format of formats) {
      const match = dateText.match(format)
      if (match) {
        console.log('Date match found:', match) // Debug log
        
        // Handle different format types
        if (match[0].includes('/')) {
          // MM/DD/YYYY format
          return new Date(match[0])
        } else if (match[0].includes('-')) {
          // YYYY-MM-DD format
          return new Date(match[0])
        } else {
          // Month Day, Year format
          const year = match[3] || new Date().getFullYear().toString()
          const dateStr = `${match[1]} ${match[2]}, ${year}`
          return new Date(dateStr)
        }
      }
    }

    // Try direct parsing as last resort
    const date = new Date(dateText)
    if (!isNaN(date.getTime())) {
      return date
    }

    return null
  } catch (error) {
    console.log('Error parsing date:', dateText, error) // Debug log
    return null
  }
}
