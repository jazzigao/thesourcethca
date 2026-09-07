import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ReviewSection } from "@/components/reviews/ReviewSection";

export default function Reviews() {
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? undefined);
  }, []);

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <div className="space-y-3 border-b border-border pb-6 pt-2">
        <Link className="text-xs font-bold uppercase tracking-[0.2em] text-primary hover:underline" href="/shop">
          Back to Current Drops
        </Link>
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Share your experience</h1>
        <p className="max-w-2xl text-muted-foreground">
          A verified note helps the next person find the right jar. Your review will publish immediately and never exposes your order details.
        </p>
      </div>
      <ReviewSection token={token} />
    </div>
  );
}