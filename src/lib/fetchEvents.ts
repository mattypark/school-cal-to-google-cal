import axios from 'axios';
import * as cheerio from 'cheerio';
import { AIService } from './ai-service';

interface ScrapedEvent {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}

export const fetchEvents = async (url: string): Promise<ScrapedEvent[]> => {
  try {
    console.log('Starting web scraping for URL:', url);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const events: ScrapedEvent[] = [];

    // Log the entire HTML structure for debugging
    console.log('Page structure:', $.html());

    // Try different selectors for events
    const selectors = [
      // Tables
      'table tr',
      'tbody tr',
      // List items
      'li.event',
      'li.calendar-event',
      // Div containers
      'div.event',
      'div[class*="event"]',
      'div[class*="calendar"]',
      // Articles
      'article',
      // Generic containers
      '.item',
      '.entry',
      // Course specific
      '.course',
      '.class',
      // Schedule specific
      '.schedule-item',
      '[class*="schedule"]'
    ];

    console.log('Trying selectors:', selectors);

    for (const selector of selectors) {
      console.log(`Checking selector: ${selector}`);
      const elements = $(selector);
      console.log(`Found ${elements.length} elements with selector ${selector}`);

      if (elements.length > 0) {
        elements.each((_, element) => {
          try {
            const $element = $(element);
            
            // Try to find title
            const title = findContent($, $element, [
              'h1', 'h2', 'h3', 'h4',
              '.title', '.summary', '.event-title',
              '[class*="title"]',
              'td:first-child',
              '.name', '.event-name',
              'strong', 'b'
            ]);

            // Try to find date
            const dateText = findContent($, $element, [
              '.date', '[class*="date"]',
              'time', '[datetime]',
              '.schedule-time',
              'td:nth-child(2)'
            ]) || $element.attr('data-date');

            // Try to find time
            const timeText = findContent($, $element, [
              '.time', '[class*="time"]',
              '.hours', '.schedule',
              'td:nth-child(3)'
            ]);

            // Try to find location
            const location = findContent($, $element, [
              '.location', '[class*="location"]',
              '.venue', '.place', '.room',
              'td:nth-child(4)'
            ]);

            // Try to find description
            const description = findContent($, $element, [
              '.description', '[class*="description"]',
              '.details', '.info', '.notes',
              'p'
            ]);

            if (title && (dateText || timeText)) {
              console.log('Found event:', { title, dateText, timeText });
              
              const event: ScrapedEvent = {
                title: title.trim(),
                date: dateText ? cleanDate(dateText) : new Date().toISOString().split('T')[0],
                description: description?.trim(),
                location: location?.trim()
              };

              if (timeText) {
                const times = parseTimeRange(timeText);
                event.startTime = times.startTime;
                event.endTime = times.endTime;
              }

              events.push(event);
            }
          } catch (error) {
            console.error('Error processing element:', error);
          }
        });
      }
    }

    console.log(`Found ${events.length} events through web scraping`);

    // If no events found through scraping, try AI extraction
    if (events.length === 0) {
      console.log('No events found through scraping, attempting AI extraction...');
      try {
        const aiEvents = await AIService.extractEventsFromHTML(data);
        return aiEvents.map(event => ({
          title: event.summary,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          description: event.description
        }));
      } catch (error) {
        console.error('AI extraction failed:', error);
      }
    }

    return events;
  } catch (error) {
    console.error('Error in web scraping:', error);
    return [];
  }
};

// Helper function to find content using multiple selectors
function findContent($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const found = $element.find(selector).first().text().trim();
    if (found) {
      console.log(`Found content with selector ${selector}:`, found);
      return found;
    }
  }
  
  // Try direct text if no selectors match
  const directText = $element.text().trim();
  if (directText) return directText;
  
  return undefined;
}

// Helper function to clean and standardize dates
function cleanDate(dateText: string): string {
  // Remove ordinal indicators and extra spaces
  dateText = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1').trim();
  
  // Try parsing as ISO date
  const isoDate = new Date(dateText);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0];
  }

  // Try common date formats
  const formats = [
    // MM/DD/YYYY
    {
      regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    },
    // Month DD, YYYY
    {
      regex: /(\w+)\s+(\d{1,2}),?\s*(\d{4})/i,
      format: (m: RegExpMatchArray) => {
        const date = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
        return date.toISOString().split('T')[0];
      }
    }
  ];

  for (const format of formats) {
    const match = dateText.match(format.regex);
    if (match) {
      try {
        return format.format(match);
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
  }

  // If all else fails, return today's date
  return new Date().toISOString().split('T')[0];
}

// Helper function to parse time ranges
function parseTimeRange(timeText: string): { startTime?: string; endTime?: string } {
  // Clean up the time text
  timeText = timeText.toLowerCase().trim();
  
  // Look for time ranges (e.g., "2:30 PM - 3:45 PM" or "14:30-15:45")
  const timeRangeRegex = /(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i;
  const match = timeText.match(timeRangeRegex);

  if (match) {
    const start = convertTo24Hour(match[1]);
    const end = convertTo24Hour(match[2]);
    return { startTime: start, endTime: end };
  }

  // Look for single time
  const singleTimeRegex = /(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i;
  const singleMatch = timeText.match(singleTimeRegex);
  if (singleMatch) {
    const time = convertTo24Hour(singleMatch[1]);
    return { startTime: time };
  }

  return {};
}

// Helper function to convert times to 24-hour format
function convertTo24Hour(timeStr: string): string {
  timeStr = timeStr.toLowerCase().trim();
  
  // If already in 24-hour format
  if (timeStr.match(/^\d{2}:\d{2}$/)) {
    return timeStr;
  }

  let hours = 0;
  let minutes = 0;

  // Parse hours and minutes
  const timeParts = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (timeParts) {
    hours = parseInt(timeParts[1]);
    minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;

    // Convert to 24-hour format
    if (timeParts[3]) {
      if (timeParts[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (timeParts[3].toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}