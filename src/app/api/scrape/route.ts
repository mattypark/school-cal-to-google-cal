import { NextResponse } from "next/server";
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    // Fetch the webpage content using axios
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const events = [];

    // Try different selectors for events
    const selectors = [
      'table tr',
      '.event',
      '.calendar-event',
      'div[class*="event"]',
      'div[class*="calendar"]',
      '[class*="schedule"]',
      '[class*="course"]'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $element = $(element);
        
        // Try to find title
        const title = findContent($, $element, [
          'h1, h2, h3, h4',
          '.title',
          '.summary',
          'td:first-child',
          'strong'
        ]);

        // Try to find date
        const dateText = findContent($, $element, [
          '.date',
          'time',
          '[datetime]',
          'td:nth-child(2)'
        ]) || $element.attr('data-date');

        // Try to find time
        const timeText = findContent($, $element, [
          '.time',
          '.hours',
          'td:nth-child(3)'
        ]);

        if (title && dateText) {
          events.push({
            title: title.trim(),
            date: formatDate(dateText),
            startTime: timeText ? parseTime(timeText).startTime : '09:00',
            endTime: timeText ? parseTime(timeText).endTime : '17:00',
            location: findContent($, $element, ['.location', '.venue', '.room']),
            description: findContent($, $element, ['.description', '.details', '.info'])
          });
        }
      });
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape events from the provided URL' },
      { status: 500 }
    );
  }
}

function findContent($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const text = $element.find(selector).first().text().trim();
    if (text) return text;
  }
  return undefined;
}

function formatDate(dateText: string): string {
  const date = new Date(dateText);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function parseTime(timeText: string): { startTime: string; endTime: string } {
  const timeMatch = timeText.match(/(\d{1,2}(?::\d{2})?(?:\s*[AP]M)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?(?:\s*[AP]M)?)/i);
  
  if (timeMatch) {
    return {
      startTime: convertTo24Hour(timeMatch[1]),
      endTime: convertTo24Hour(timeMatch[2])
    };
  }
  
  return {
    startTime: '09:00',
    endTime: '17:00'
  };
}

function convertTo24Hour(timeStr: string): string {
  const [time, modifier] = timeStr.split(/\s*(AM|PM)/i);
  let [hours, minutes = '00'] = time.split(':');
  
  let hour = parseInt(hours, 10);
  
  if (modifier?.toUpperCase() === 'PM' && hour < 12) {
    hour += 12;
  }
  if (modifier?.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
} 