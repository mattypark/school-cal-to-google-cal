import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-white text-center">
          Log in with Google
        </h1>

        <Button 
          variant="secondary" 
          size="lg"
          className="w-64"
        >
          Sign in with Google
        </Button>

        <div className="w-full max-w-md space-y-4">
          <Input
            type="url"
            placeholder="Enter your school calendar URL"
            className="bg-white"
          />
          <Button 
            className="w-full"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}