import { NextResponse } from 'next/server';
import { fetchEvents } from '@/lib/fetchEvents';
import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/getGoogleAuth';

export async function POST(request: Request) {
  const { url } = await request.json();

  const events = await fetchEvents(url);

  // Assuming you have a function to get the authenticated Google Calendar client
  const auth = await getGoogleAuth(); // Implement this function
  const calendar = google.calendar({ version: 'v3', auth });

  const promises = events.map(event => {
    return calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        start: {
          dateTime: event.date, // Ensure this is in ISO format
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: new Date(new Date(event.date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour later
          timeZone: 'America/New_York',
        },
      },
    });
  });

  try {
    await Promise.all(promises);
    return NextResponse.json({ message: 'Events added successfully!' });
  } catch (error) {
    console.error('Error adding events:', error);
    return NextResponse.json({ error: 'Failed to add events' }, { status: 500 });
  }
} 