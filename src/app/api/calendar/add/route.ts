import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CalendarService } from "@/lib/calendar-service"
import { parseSchoolCalendar } from "@/lib/calendar-parser"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      console.log('No access token found') // Debug log
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { url } = await req.json()
    console.log('Parsing calendar from URL:', url) // Debug log
    
    // Parse the school calendar
    const events = await parseSchoolCalendar(url)
    console.log('Found events:', events) // Debug log
    
    if (events.length === 0) {
      return NextResponse.json({
        error: "No events found on the provided page"
      }, { status: 400 })
    }
    
    // Add events to Google Calendar
    const results = await Promise.all(
      events.map(event => 
        CalendarService.addEvent(session.accessToken!, event)
      )
    )
    
    console.log('Added events:', results) // Debug log

    return NextResponse.json({ 
      success: true, 
      addedEvents: results.length 
    })
  } catch (error) {
    console.error('Error in calendar API:', error)
    return NextResponse.json(
      { error: "Failed to add events to calendar" },
      { status: 500 }
    )
  }
}