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

    // Common selectors for calendar events
    const eventSelectors = [
      '.event', '.calendar-event', '.event-item',  // Generic event classes
      '[class*="event"]', '[class*="calendar"]',   // Partial matches
      'tr[data-date]', 'div[data-date]',          // Elements with date attributes
      '.fc-event', '.vevent'                       // FullCalendar and hCalendar classes
    ].join(', ')

    // Find all potential event elements
    $(eventSelectors).each((_, element) => {
      const $element = $(element)
      
      // Try to find the title
      const title = $element.find('[class*="title"], [class*="summary"], h3, h4').first().text().trim() ||
                   $element.find('*').filter((_, el) => /title|summary|subject/i.test($(el).attr('class') || '')).first().text().trim()

      // Try to find the date
      const dateElement = $element.find('[class*="date"], [class*="time"], time').first()
      const dateText = dateElement.text().trim() ||
                      dateElement.attr('datetime') ||
                      $element.attr('data-date') ||
                      ''

      // Try to find the description
      const description = $element.find('[class*="desc"], [class*="details"]').first().text().trim()

      console.log('Found potential event:', { title, dateText, description })

      if (title && dateText) {
        const eventDate = parseEventDate(dateText)
        if (eventDate) {
          const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000) // Default 1 hour duration
          
          events.push({
            summary: title,
            description: description || undefined,
            start: {
              dateTime: eventDate.toISOString(),
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: 'America/New_York',
            },
          })
        }
      }
    })

    // If no events found with specific selectors, try a more general approach
    if (events.length === 0) {
      // Look for any text that contains a date pattern
      $('*').contents().each((_, node) => {
        if (node.type === 'text') {
          const text = $(node).text().trim()
          if (text.length > 10) { // Minimum length to potentially contain a date
            const dateMatch = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}?\b/i)
            if (dateMatch) {
              const eventDate = parseEventDate(dateMatch[0])
              if (eventDate) {
                const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000)
                events.push({
                  summary: text.substring(0, 100), // Use first 100 chars as summary
                  start: {
                    dateTime: eventDate.toISOString(),
                    timeZone: 'America/New_York',
                  },
                  end: {
                    dateTime: endDate.toISOString(),
                    timeZone: 'America/New_York',
                  },
                })
              }
            }
          }
        }
      })
    }

    console.log('Total events found:', events.length)
    return events
  } catch (error) {
    console.error('Error parsing calendar:', error)
    throw new Error('Failed to parse calendar data')
  }
}

function parseEventDate(dateText: string): Date | null {
  try {
    // Remove ordinal indicators and extra whitespace
    dateText = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1').trim()

    // Try parsing with built-in Date
    let date = new Date(dateText)
    if (!isNaN(date.getTime())) {
      return date
    }

    // Try common date formats
    const formats = [
      // MM/DD/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // YYYY-MM-DD
      /(\d{4})-(\d{2})-(\d{2})/,
      // Month DD, YYYY
      /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i
    ]

    for (const format of formats) {
      const match = dateText.match(format)
      if (match) {
        if (format.source.includes('YYYY-MM-DD')) {
          return new Date(match[0])
        } else if (format.source.includes('MM/DD/YYYY')) {
          return new Date(match[0])
        } else {
          // Month DD, YYYY format
          const year = match[3] || new Date().getFullYear().toString()
          return new Date(`${match[1]} ${match[2]}, ${year}`)
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing date:', dateText, error)
    return null
  }
}
