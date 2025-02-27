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
    console.log('Fetching URL:', url);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const events: ScrapedEvent[] = [];

    // Common patterns for event containers
    const eventContainers = [
      // Calendar specific selectors
      '.calendar-event',
      '.event',
      '.vevent',
      '[class*="event"]',
      // Course specific selectors
      '.course-item',
      '.class-schedule',
      '[class*="course"]',
      // Table based selectors
      'tr[data-date]',
      'tr:has(td:nth-child(1):contains("Date"))',
      // Generic containers that might contain event info
      '[class*="schedule"] > div',
      '[class*="calendar"] > div'
    ].join(', ');

    console.log('Scanning for events using Cheerio...');

    $(eventContainers).each((_, element) => {
      try {
        const $element = $(element);
        
        // Try multiple approaches to find the title
        const title = findText($, $element, [
          '[class*="title"]',
          '[class*="summary"]',
          'h3, h4',
          'td:first-child',
          '.course-name',
          '.event-name'
        ]);

        // Try to find date information
        const dateText = findText($, $element, [
          '[class*="date"]',
          'time',
          '[datetime]',
          'td:nth-child(2)',
          '.event-date'
        ]) || $element.attr('data-date');

        // Try to find time information
        const timeText = findText($, $element, [
          '[class*="time"]',
          '.hours',
          'td:nth-child(3)',
          '.event-time'
        ]);

        // Try to find location
        const location = findText($, $element, [
          '[class*="location"]',
          '[class*="venue"]',
          '[class*="room"]',
          '.place'
        ]);

        // Try to find description
        const description = findText($, $element, [
          '[class*="description"]',
          '[class*="details"]',
          '.notes',
          '.info'
        ]);

        if (title && dateText) {
          // Parse time information
          const { startTime, endTime } = parseTimeInfo(timeText);

          // Clean up the date text
          const cleanDate = cleanDateText(dateText);

          events.push({
            title: title.trim(),
            date: cleanDate,
            startTime,
            endTime,
            location: location?.trim(),
            description: description?.trim()
          });
        }
      } catch (error) {
        console.error('Error processing event element:', error);
      }
    });

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
    console.error('Error fetching events:', error);
    return [];
  }
};

// Helper function to find text using multiple selectors
function findText($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const text = $element.find(selector).first().text().trim();
    if (text) return text;
  }
  return undefined;
}

// Helper function to parse time information
function parseTimeInfo(timeText: string | undefined): { startTime?: string; endTime?: string } {
  if (!timeText) return {};

  // Common time formats: "HH:MM - HH:MM", "HH:MM to HH:MM", "HH:MM"
  const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})/i);
  if (timeMatch) {
    return {
      startTime: timeMatch[1],
      endTime: timeMatch[2]
    };
  }

  // Single time format
  const singleTimeMatch = timeText.match(/(\d{1,2}:\d{2})/);
  if (singleTimeMatch) {
    return {
      startTime: singleTimeMatch[1]
    };
  }

  return {};
}

// Helper function to clean and standardize date text
function cleanDateText(dateText: string): string {
  // Remove ordinal indicators
  dateText = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1');
  
  // Try parsing as ISO date first
  const isoDate = new Date(dateText);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0];
  }

  // Handle various date formats
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

  // If all else fails, return the original date text
  return dateText;
}