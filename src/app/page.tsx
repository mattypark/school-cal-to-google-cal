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

  const handleSubmit = async () => {
    if (!url || !session?.accessToken) return

    setIsLoading(true)
    setError(null)
    setStatus("Starting...")

    try {
      setStatus("Fetching calendar data...")
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

      if (data.addedEvents === 0) {
        setStatus("No events were found. Please check the URL and try again.")
      } else {
        setStatus(`Successfully added ${data.addedEvents} events to your calendar!`)
        setUrl("")
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">School Calendar Sync</h1>

      {!session ? (
        <Button onClick={() => signIn("google")}>
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
              placeholder="Paste your school calendar URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
              {isLoading ? "Processing..." : "Add to Calendar"}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-gray-100 rounded-md text-sm">
            <p>For best results, try these URLs:</p>
            <ul className="list-disc pl-4 mt-2">
              <li>Your school's calendar page</li>
              <li>The events or announcements page</li>
              <li>Any page containing upcoming events</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}