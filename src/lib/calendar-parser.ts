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
  recurrence?: string[];
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
              recurrence: event.recurrence,
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
      '.fc-event', '.vevent',
      // Add more common calendar selectors
      'table tr', // For table-based schedules
      '[class*="schedule"]', // For schedule-based layouts
      '[class*="course"]', // For course schedules
      '[class*="class"]', // For class schedules
    ].join(', ')

    $(eventSelectors).each((_, element) => {
      const $element = $(element)
      
      // Try multiple approaches to find the title
      const title = $element.find('[class*="title"], [class*="summary"], h3, h4').first().text().trim() ||
                   $element.find('*').filter((_, el) => /title|summary|subject|course/i.test($(el).attr('class') || '')).first().text().trim() ||
                   $element.find('td').first().text().trim() // For table-based layouts

      // Try to find date and time information
      const dateElement = $element.find('[class*="date"], [class*="time"], time').first()
      const dateText = dateElement.text().trim() ||
                      dateElement.attr('datetime') ||
                      $element.attr('data-date') ||
                      $element.find('td').eq(1).text().trim() || // For table-based layouts
                      ''

      // Try to find description and location
      const description = $element.find('[class*="desc"], [class*="details"]').first().text().trim()
      const location = $element.find('[class*="location"], [class*="venue"], [class*="room"]').first().text().trim()

      if (title && dateText) {
        const eventDate = parseEventDate(dateText)
        if (eventDate) {
          // Try to extract time information
          const timeMatch = dateText.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})/i)
          const startTime = timeMatch ? timeMatch[1] : '00:00'
          const endTime = timeMatch ? timeMatch[2] : addHours(startTime, 1)

          const startDateTime = new Date(eventDate)
          const [startHours, startMinutes] = startTime.split(':').map(Number)
          startDateTime.setHours(startHours, startMinutes)

          const endDateTime = new Date(eventDate)
          const [endHours, endMinutes] = endTime.split(':').map(Number)
          endDateTime.setHours(endHours, endMinutes)

          events.push({
            summary: title,
            description,
            location,
            start: {
              dateTime: startDateTime.toISOString(),
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: endDateTime.toISOString(),
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
    // Remove ordinal indicators and clean up the text
    dateText = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1')
                      .replace(/\s+/g, ' ')
                      .trim()

    // Try parsing as is first
    let date = new Date(dateText)
    if (!isNaN(date.getTime())) {
      return date
    }

    // Common date formats to try
    const formats = [
      // MM/DD/YYYY
      {
        regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        parse: (m: RegExpMatchArray) => new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
      },
      // YYYY-MM-DD
      {
        regex: /(\d{4})-(\d{2})-(\d{2})/,
        parse: (m: RegExpMatchArray) => new Date(m[0])
      },
      // Month DD, YYYY
      {
        regex: /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i,
        parse: (m: RegExpMatchArray) => {
          const year = m[3] || new Date().getFullYear().toString()
          return new Date(`${m[1]} ${m[2]}, ${year}`)
        }
      },
      // DD Month YYYY
      {
        regex: /(\d{1,2})\s+(\w+)\s+(\d{4})/i,
        parse: (m: RegExpMatchArray) => new Date(`${m[2]} ${m[1]}, ${m[3]}`)
      }
    ]

    for (const format of formats) {
      const match = dateText.match(format.regex)
      if (match) {
        try {
          const parsedDate = format.parse(match)
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate
          }
        } catch (e) {
          console.error('Error parsing date format:', e)
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
