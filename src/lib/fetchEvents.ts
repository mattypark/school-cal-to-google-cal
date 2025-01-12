import axios from 'axios';
import * as cheerio from 'cheerio';

export const fetchEvents = async (url: string) => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const events: { title: string; date: string }[] = [];

    // Adjust the selectors based on the structure of the page
    $('.calendar-event-selector').each((i, element) => {
      const title = $(element).find('.event-title-selector').text();
      const dateText = $(element).find('.event-date-selector').text();

      // Parse the dateText to a valid Date object
      const eventDate = new Date(dateText.replace(/(\w+) (\d+), (\d+)/, '$3-$1-$2'));
      if (!isNaN(eventDate.getTime())) {
        events.push({ title, date: eventDate.toISOString() });
      } else {
        console.error(`Invalid date format for event: ${title}`);
      }
    });

    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};