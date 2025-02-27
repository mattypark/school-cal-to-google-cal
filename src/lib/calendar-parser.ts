import axios from 'axios'
import * as cheerio from 'cheerio'
import { AIService } from './ai-service'

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
    const html = response.data
    
    // First try AI-based extraction
    try {
      console.log('Attempting AI-based event extraction...')
      const extractedEvents = await AIService.extractEventsFromHTML(html)
      console.log('AI extracted events:', extractedEvents)
      
      if (extractedEvents.length > 0) {
        // Convert extracted events to calendar events
        const calendarEvents: CalendarEvent[] = await Promise.all(
          extractedEvents.map(async (event) => {
            // Try to enhance the description using AI
            const enhancedEvent = await AIService.enhanceEventDescription(event)
            
            // Construct the event datetime
            const dateStr = event.date
            const startTimeStr = event.startTime || '00:00'
            const endTimeStr = event.endTime || 
              (event.startTime ? addHours(event.startTime, 1) : '23:59')
            
            return {
              summary: enhancedEvent.summary,
              description: enhancedEvent.description,
              location: enhancedEvent.location,
              start: {
                dateTime: `${dateStr}T${startTimeStr}:00`,
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: `${dateStr}T${endTimeStr}:00`,
                timeZone: 'America/New_York',
              },
            }
          })
        )
        
        console.log('Successfully created calendar events:', calendarEvents)
        return calendarEvents
      }
    } catch (error) {
      console.error('AI extraction failed, falling back to traditional parsing:', error)
    }
    
    // Fall back to traditional parsing if AI fails
    const $ = cheerio.load(html)
    const events: CalendarEvent[] = []

    // Common selectors for calendar events
    const eventSelectors = [
      '.event', '.calendar-event', '.event-item',
      '[class*="event"]', '[class*="calendar"]',
      'tr[data-date]', 'div[data-date]',
      '.fc-event', '.vevent'
    ].join(', ')

    $(eventSelectors).each((_, element) => {
      const $element = $(element)
      
      const title = $element.find('[class*="title"], [class*="summary"], h3, h4').first().text().trim() ||
                   $element.find('*').filter((_, el) => /title|summary|subject/i.test($(el).attr('class') || '')).first().text().trim()

      const dateElement = $element.find('[class*="date"], [class*="time"], time').first()
      const dateText = dateElement.text().trim() ||
                      dateElement.attr('datetime') ||
                      $element.attr('data-date') ||
                      ''

      const description = $element.find('[class*="desc"], [class*="details"]').first().text().trim()
      const location = $element.find('[class*="location"], [class*="venue"]').first().text().trim()

      if (title && dateText) {
        const eventDate = parseEventDate(dateText)
        if (eventDate) {
          const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000)
          events.push({
            summary: title,
            description,
            location,
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

    console.log('Total events found:', events.length)
    return events
  } catch (error) {
    console.error('Error parsing calendar:', error)
    throw new Error('Failed to parse calendar data')
  }
}

function parseEventDate(dateText: string): Date | null {
  try {
    dateText = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1').trim()

    let date = new Date(dateText)
    if (!isNaN(date.getTime())) {
      return date
    }

    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
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

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const newHour = (h + hours) % 24
  return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
