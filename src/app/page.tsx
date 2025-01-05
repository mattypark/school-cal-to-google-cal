"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn, signOut, useSession } from "next-auth/react"
import { useState } from "react"

export default function Home() {
  const { data: session, status } = useSession()
  const [calendarUrl, setCalendarUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!calendarUrl || !session?.accessToken) return
    
    setIsLoading(true)
    try {
      const response = await fetch("/api/calendar/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: calendarUrl }),
      })
      
      if (!response.ok) throw new Error("Failed to add events")
      
      alert("Events added successfully!")
      setCalendarUrl("")
    } catch (error) {
      console.error(error)
      alert("Failed to add events")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-white text-center">
          Calendar Sync
        </h1>

        {status === "loading" ? (
          <div>Loading...</div>
        ) : !session ? (
          <Button 
            variant="secondary" 
            size="lg"
            className="w-64"
            onClick={() => signIn("google")}
          >
            Sign in with Google
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <p className="text-white">Signed in as {session.user?.email}</p>
              <Button 
                variant="secondary"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>

            <div className="w-full max-w-md space-y-4">
              <Input
                type="url"
                placeholder="Enter your school calendar URL"
                className="bg-white"
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
              />
              <Button 
                className="w-full"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Adding Events..." : "Submit"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}