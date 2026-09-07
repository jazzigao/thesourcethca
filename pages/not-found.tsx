import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <h1 className="font-serif text-5xl">404</h1>
      <p className="text-xl text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild variant="outline" className="rounded-md font-serif text-lg px-8 h-12">
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  );
}
