import {
  getListReviewsQueryKey,
  useClaimReview,
  useListReviews,
  useSubmitReview,
  type ReviewClaimLink,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Star } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.replace(/^HTTP \d+[^:]*:\s*/, "") : fallback;
}

export function ReviewSection({ token }: { token?: string }) {
  const queryClient = useQueryClient();
  const reviewsQuery = useListReviews({
    query: { queryKey: getListReviewsQueryKey(), staleTime: 30_000, refetchInterval: 60_000 },
  });
  const claim = useClaimReview();
  const submit = useSubmitReview();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [claims, setClaims] = useState<ReviewClaimLink[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ReviewClaimLink | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const activeClaim = token
    ? claims.find((claimLink) => claimLink.token === token) ?? {
        productId: "",
        productName: "your purchase",
        token,
        reviewUrl: "",
        expiresAt: new Date().toISOString(),
      }
    : selectedClaim;

  const average = useMemo(() => {
    const reviews = reviewsQuery.data ?? [];
    return reviews.length
      ? (reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1)
      : null;
  }, [reviewsQuery.data]);

  const handleClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    claim.mutate(
      { data: { orderNumber, email } },
      {
        onSuccess: (data) => {
          setClaims(data.claims);
          setSelectedClaim(data.claims[0] ?? null);
          if (data.claims.length) toast.success("Purchase verified. Your review link is ready.");
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeClaim) return;
    submit.mutate(
      { data: { token: activeClaim.token, reviewerName, rating, text: reviewText } },
      {
        onSuccess: async () => {
          setReviewerName("");
          setReviewText("");
          await queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
          toast.success("Thank you — your review is now live.");
        },
      },
    );
  };

  return (
    <section className="mt-16 border-t border-border pt-10" aria-labelledby="reviews-title">
      {!token && (
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">From the table</span>
            <h2 id="reviews-title" className="font-serif text-4xl tracking-tight">Purchaser notes</h2>
            <p className="max-w-lg text-muted-foreground">
              Every review comes from a paid Shopify order. Share the jar, the cultivar, and the moment it found you.
            </p>
            {average && (
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                <Star className="h-4 w-4 fill-current" /> {average} average from {reviewsQuery.data?.length} reviews
              </p>
            )}
          </div>
          <form onSubmit={handleClaim} className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
              <ShieldCheck className="h-4 w-4" /> Verify a purchase
            </div>
            <p className="text-sm text-muted-foreground">Use the order number and buyer email from your Shopify receipt. No account required.</p>
            <Input
              aria-label="Shopify order number"
              maxLength={100}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="Order number, e.g. #1001"
              required
              value={orderNumber}
            />
            <Input
              aria-label="Buyer email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Buyer email"
              required
              type="email"
              value={email}
            />
            <Button className="w-full rounded-full" disabled={claim.isPending} type="submit">
              {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find my purchase"}
            </Button>
            {claim.isError && <p className="text-sm text-destructive">{errorMessage(claim.error, "We could not verify that purchase.")}</p>}
            {claims.length > 0 && (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Choose a product to review</p>
                <div className="flex flex-wrap gap-2">
                  {claims.map((claimLink) => (
                    <button
                      className={`rounded-full border px-3 py-2 text-left text-sm transition-colors ${selectedClaim?.productId === claimLink.productId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                      key={claimLink.productId}
                      onClick={() => setSelectedClaim(claimLink)}
                      type="button"
                    >
                      {claimLink.productName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {(activeClaim || token) && (
        <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-2xl space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Verified purchaser</p>
            <h3 className="mt-1 font-serif text-2xl">Review {activeClaim?.productName}</h3>
          </div>
          <Input
            aria-label="Your name"
            maxLength={80}
            minLength={2}
            onChange={(event) => setReviewerName(event.target.value)}
            placeholder="Your name"
            required
            value={reviewerName}
          />
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rating</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  aria-label={`${value} out of 5 stars`}
                  aria-pressed={rating === value}
                  className="rounded-md p-1 text-primary transition-transform hover:scale-110"
                  key={value}
                  onClick={() => setRating(value)}
                  type="button"
                >
                  <Star className={`h-6 w-6 ${value <= rating ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
          </div>
          <Textarea
            aria-label="Your review"
            maxLength={2000}
            minLength={10}
            onChange={(event) => setReviewText(event.target.value)}
            placeholder="What stood out about this drop?"
            required
            rows={5}
            value={reviewText}
          />
          <Button className="rounded-full" disabled={submit.isPending} type="submit">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish review"}
          </Button>
          {submit.isError && <p className="text-sm text-destructive">{errorMessage(submit.error, "Unable to publish the review.")}</p>}
        </form>
      )}

      {!token && (
        <div className="mt-12 space-y-4">
          {reviewsQuery.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
          {reviewsQuery.isError && <p className="text-sm text-muted-foreground">Purchaser notes are taking a moment to load.</p>}
          {!reviewsQuery.isLoading && !reviewsQuery.data?.length && (
            <p className="text-muted-foreground">The first notes from this drop will land here soon.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(reviewsQuery.data ?? []).map((review) => (
              <article className="rounded-2xl border border-border bg-card/50 p-5" key={review.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl">{review.productName}</h3>
                  <span className="flex items-center gap-1 text-sm text-primary" aria-label={`${review.rating} out of 5 stars`}>
                    <Star className="h-4 w-4 fill-current" /> {review.rating}/5
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.text}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">{review.reviewerName}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}