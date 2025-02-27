import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CalendarService } from "@/lib/calendar-service"
import { parseSchoolCalendar } from "@/lib/calendar-parser"
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

    console.log('Parsing calendar from URL:', url)
    
    // Parse the school calendar
    const events = await parseSchoolCalendar(url)
    console.log(`Found ${events.length} events to add:`, JSON.stringify(events, null, 2))
    
    if (events.length === 0) {
      return NextResponse.json({
        error: "No events found on the provided page. Please check the URL and try again."
      }, { status: 400 })
    }
    
    // Add events to Google Calendar
    const addedEvents = []
    const errors = []

    console.log('Starting to add events to Google Calendar...')
    console.log('Using access token:', session.accessToken?.substring(0, 10) + '...')

    for (const event of events) {
      try {
        console.log('Adding event:', JSON.stringify(event, null, 2))
        const result = await CalendarService.addEvent(session.accessToken, event)
        console.log('Successfully added event:', result)
        addedEvents.push(result)
      } catch (error) {
        console.error('Error adding event:', error)
        errors.push({
          event: event.summary,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    if (addedEvents.length === 0 && errors.length > 0) {
      console.error('Failed to add any events. Errors:', errors)
      return NextResponse.json({
        error: "Failed to add any events to calendar",
        details: errors
      }, { status: 500 })
    }

    console.log(`Successfully added ${addedEvents.length} events to calendar`)
    return NextResponse.json({ 
      success: true, 
      addedEvents: addedEvents.length,
      totalEvents: events.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error in calendar API:', error)
    return NextResponse.json(
      { 
        error: "Failed to process calendar",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}