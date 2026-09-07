import {
  getGetLoyaltyQueryKey,
  getListOrdersQueryKey,
  useGetLoyalty,
  useListOrders,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Clock, Award, LogOut, UserRound } from "lucide-react";
import { Link } from "wouter";

export default function Account() {
  const { user, isAuthenticated, isLoading: isAuthLoading, login, logout } = useAuth();
  const { data: loyalty, isLoading: isLoyaltyLoading } = useGetLoyalty({
    query: { enabled: isAuthenticated, queryKey: getGetLoyaltyQueryKey() },
  });
  const { data: orders = [], isLoading: isOrdersLoading } = useListOrders({
    query: { enabled: isAuthenticated, queryKey: getListOrdersQueryKey() },
  });

  if (isAuthLoading || (isAuthenticated && (isLoyaltyLoading || isOrdersLoading))) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
       <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
         <div className="listing-surface pine-border px-5 py-8 md:px-8 md:py-10 text-center space-y-5">
          <UserRound className="h-10 w-10 text-primary mx-auto" />
           <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">The Source Members</p>
            <h1 className="font-serif text-4xl md:text-6xl">Your harvest, kept close.</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Sign up or log in to see your points and keep every member checkout in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={login}>Sign Up</Button>
            <Button size="lg" variant="outline" onClick={login}>Log In</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Prefer not to join? Guest checkout is still available from your cart.
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.firstName || user?.email || "Member";
  const progress = loyalty
    ? Math.min(100, Math.max(0, 100 - loyalty.dollarsToNextReward))
    : 0;

  return (
     <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="space-y-3 border-b border-border pb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Signed in</p>
            <h1 className="font-serif text-4xl md:text-5xl">Welcome, {displayName}</h1>
            <p className="text-xl text-muted-foreground">Your orders and member benefits, all together.</p>
          </div>
          <Button variant="outline" onClick={logout} className="w-fit">
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Points Card */}
         <div className="listing-surface pine-border p-5 rounded-md space-y-3 md:col-span-2">
          <div className="flex items-center gap-3 text-primary">
            <Star className="h-6 w-6" />
            <h2 className="font-serif text-2xl text-foreground">Seed Points</h2>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-serif">{loyalty?.points || 0}</span>
            <span className="text-muted-foreground uppercase tracking-wider text-sm font-medium">pts</span>
          </div>
          
          <p className="text-muted-foreground">
            {loyalty?.rewardMessage || "Earn points on every purchase to unlock exclusive rewards."}
          </p>
          
          {loyalty?.dollarsToNextReward !== undefined && loyalty.dollarsToNextReward > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium">Spend ${loyalty.dollarsToNextReward} more to unlock your next reward.</p>
              <div className="w-full h-2 bg-muted mt-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
           <div className="listing-surface pine-border p-5 rounded-md flex flex-col items-center justify-center text-center h-full gap-3 hover:border-secondary transition-colors cursor-pointer">
            <Award className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Redeem Rewards</h3>
              <p className="text-sm text-muted-foreground mt-1">View available offers</p>
            </div>
          </div>
        </div>
      </div>

       <div className="space-y-4">
        <h3 className="font-serif text-3xl">Recent Orders</h3>
        {orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => (
               <article key={order.id} className="listing-surface pine-border p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Order {order.id.replace("order_", "#")}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="font-serif text-2xl">${order.subtotal.toFixed(2)}</p>
                </div>
                 <div className="border-t border-border pt-3 space-y-2">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.productId}-${item.grams}`} className="flex justify-between gap-4 text-sm">
                       <span className="item-title">{item.productName}</span>
                       <span> · {item.grams}g × {item.quantity}</span>
                      <span className="text-muted-foreground">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
           <div className="listing-surface pine-border rounded-md p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Clock className="h-10 w-10 opacity-50" />
            <p>No member orders yet. Your next signed-in checkout will appear here.</p>
             <Button asChild variant="outline" className="rounded-md mt-3">
              <Link href="/shop">Browse Shop</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
