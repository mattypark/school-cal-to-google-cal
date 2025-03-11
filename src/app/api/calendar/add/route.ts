import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CalendarService } from "@/lib/calendar-service"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      console.error('No access token found in session')
      return NextResponse.json(
        { error: "Please sign in again" },
        { status: 401 }
      )
    }

    const { url } = await req.json()
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    // First, scrape the events using our scrape endpoint
    const scrapeResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeData.events || scrapeData.events.length === 0) {
      return NextResponse.json({
        error: "No events found on the provided page"
      }, { status: 400 });
    }

    // Convert to Google Calendar format
    const calendarEvents = scrapeData.events.map(event => ({
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      start: {
        dateTime: `${event.date}T${event.startTime}:00`,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: `${event.date}T${event.endTime}:00`,
        timeZone: 'America/New_York',
      }
    }));

    // Add events to Google Calendar
    const results = await CalendarService.batchAddEvents(session.accessToken, calendarEvents);

    return NextResponse.json({
      message: 'Events processed',
      addedEvents: results.successful,
      failedEvents: results.failed,
      errors: results.errors,
      events: scrapeData.events
    });

  } catch (error) {
    console.error('Error processing events:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process events' },
      { status: 500 }
    )
  }
}