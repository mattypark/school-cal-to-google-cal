"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn, signOut, useSession } from "next-auth/react"
import { useState } from "react"

export default function Home() {
  const { data: session } = useSession()
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [scrapedData, setScrapedData] = useState<any>(null)

  const handleSubmit = async () => {
    if (!url) {
      setError("Please enter a URL")
      return
    }
    
    if (!session?.accessToken) {
      setError("Please sign in first")
      return
    }

    setIsLoading(true)
    setError(null)
    setStatus("Starting...")
    setScrapedData(null)

    try {
      // First, try to validate the URL
      try {
        new URL(url);
      } catch {
        throw new Error("Please enter a valid URL (e.g., https://example.com)");
      }

      setStatus("Analyzing webpage content...")
      const response = await fetch("/api/calendar/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to add events")
      }

      // Show the scraped data in the UI
      if (data.events) {
        setScrapedData(data.events)
      }

      if (data.addedEvents === 0) {
        setStatus("No events were found. Please check the URL and try again.")
      } else {
        setStatus(`Successfully added ${data.addedEvents} events to your calendar!`)
        setUrl("")
      }

      // If there were any errors during the process, show them
      if (data.errors?.length > 0) {
        console.error('Some events failed to add:', data.errors)
        setError(`Successfully added ${data.addedEvents} events, but ${data.errors.length} failed. Check console for details.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process calendar"
      setError(message)
      setStatus(null)
      console.error('Error details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    try {
      await signIn("google", {
        callbackUrl: window.location.href,
        prompt: "consent",
      })
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Failed to sign in. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Calendar Event Extractor</h1>

      {!session ? (
        <Button onClick={handleSignIn}>
          Sign in with Google
        </Button>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <p>Signed in as {session.user?.email}</p>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              type="url"
              placeholder="Paste any webpage URL containing events"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            {status && !error && (
              <p className="text-blue-500 text-sm">{status}</p>
            )}
            <Button 
              className="w-full"
              onClick={handleSubmit}
              disabled={isLoading || !url}
            >
              {isLoading ? "Processing..." : "Extract & Add Events"}
            </Button>
          </div>

          {scrapedData && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <h2 className="font-semibold mb-2">Found Events:</h2>
              <div className="space-y-2">
                {scrapedData.map((event: any, index: number) => (
                  <div key={index} className="p-2 bg-white rounded border">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-gray-600">
                      {event.date} {event.startTime && `at ${event.startTime}`}
                      {event.endTime && ` - ${event.endTime}`}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-500">{event.location}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-100 rounded-md text-sm">
            <p>You can try any webpage that contains events, such as:</p>
            <ul className="list-disc pl-4 mt-2">
              <li>School course schedules</li>
              <li>Event listing pages</li>
              <li>Conference schedules</li>
              <li>Sports calendars</li>
              <li>Class timetables</li>
              <li>Any page with dates and times</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}