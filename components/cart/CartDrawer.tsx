import { X, Plus, Minus, Loader2 } from "lucide-react";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/button";
import {
  getGetLoyaltyQueryKey,
  getListOrdersQueryKey,
  createOrder,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure checkout is unavailable in this browser. Please update your browser and try again.");
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, cartTotal, ageVerified, jurisdictionConfirmed } = useCart();
  const [checkoutState, setCheckoutState] = useState<'idle' | 'loading'>('idle');
  const [pressedQuantityButton, setPressedQuantityButton] = useState<string | null>(null);
  const checkoutInFlight = useRef(false);
  const checkoutAttempt = useRef<{ review: string; idempotencyKey: string } | null>(null);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (checkoutInFlight.current) return;
    if (!ageVerified || !jurisdictionConfirmed) {
      alert("Please confirm your age and delivery jurisdiction before continuing.");
      return;
    }

    const orderItems = items.map(i => ({
      productId: i.productId,
      grams: i.grams,
      quantity: i.quantity
    }));
    const checkoutData = {
      items: orderItems,
      subtotal: cartTotal,
      guestCheckout: !isAuthenticated,
      ageVerified,
      jurisdictionConfirmed
    };
    const review = JSON.stringify(checkoutData);
    const idempotencyKey = checkoutAttempt.current?.review === review
      ? checkoutAttempt.current.idempotencyKey
      : createIdempotencyKey();

    checkoutAttempt.current = { review, idempotencyKey };
    checkoutInFlight.current = true;
    setCheckoutState('loading');

    try {
      const order = await createOrder(checkoutData, {
        headers: { "Idempotency-Key": idempotencyKey },
      });

      if (isAuthenticated) {
        void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetLoyaltyQueryKey() });
      }

      // The payment and regulated-product checks happen on Shopify's hosted
      // checkout. Never collect or simulate payment in this storefront.
      // Keep the cart until Shopify confirms a completed purchase so returning
      // shoppers can recover from a closed or interrupted hosted checkout.
      window.location.assign(order.checkoutUrl);
    } catch (error) {
      setCheckoutState('idle');
      alert(error instanceof Error ? error.message : "Failed to open secure checkout. Please try again.");
    } finally {
      checkoutInFlight.current = false;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      <div className="cart-drawer-panel fixed top-0 right-0 bottom-0 w-full max-w-md listing-surface border-l border-border z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="cart-drawer-header p-6 flex items-center justify-between border-b border-border">
          <h2 className="font-serif text-3xl">Your Cart</h2>
          <button type="button" aria-label="Close cart" onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <p className="font-serif text-2xl">Your cart is empty</p>
              <Button onClick={() => setIsCartOpen(false)} variant="outline">
                Browse Shop
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => {
                const decrementKey = `decrement-${item.productId}-${item.grams}`;
                const incrementKey = `increment-${item.productId}-${item.grams}`;

                return (
                <div key={`${item.productId}-${item.grams}`} className="flex gap-4 border-b border-border pb-6">
                   <div className="image-double-border h-24 w-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      width={1024}
                      height={1024}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between">
                       <h4 className="item-title text-lg">{item.name}</h4>
                      <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-auto">{item.grams}g</p>
                    
                    <div className="flex items-center gap-3 mt-4">
                      <button 
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => updateQuantity(item.productId, item.grams, item.quantity - 1)}
                        onPointerDown={() => setPressedQuantityButton(decrementKey)}
                        onPointerUp={() => setPressedQuantityButton(null)}
                        onPointerCancel={() => setPressedQuantityButton(null)}
                        onPointerLeave={() => setPressedQuantityButton(null)}
                        data-pressed={pressedQuantityButton === decrementKey}
                        style={pressedQuantityButton === decrementKey ? {
                          backgroundColor: "hsl(var(--primary))",
                          borderColor: "hsl(var(--primary))",
                          color: "hsl(var(--primary-foreground))",
                          transform: "scale(0.94)",
                        } : undefined}
                        className="quantity-button"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button 
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() => updateQuantity(item.productId, item.grams, item.quantity + 1)}
                        onPointerDown={() => setPressedQuantityButton(incrementKey)}
                        onPointerUp={() => setPressedQuantityButton(null)}
                        onPointerCancel={() => setPressedQuantityButton(null)}
                        onPointerLeave={() => setPressedQuantityButton(null)}
                        data-pressed={pressedQuantityButton === incrementKey}
                        style={pressedQuantityButton === incrementKey ? {
                          backgroundColor: "hsl(var(--primary))",
                          borderColor: "hsl(var(--primary))",
                          color: "hsl(var(--primary-foreground))",
                          transform: "scale(0.94)",
                        } : undefined}
                        className="quantity-button"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.grams, 0)}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer p-6 border-t border-border bg-background/50 backdrop-blur-sm space-y-4">
            <div className="flex justify-between font-medium text-lg">
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Taxes and shipping calculated at checkout.</p>
            <Button 
              className="w-full h-14 text-lg font-serif rounded-full"
              onClick={handleCheckout}
              disabled={checkoutState === 'loading'}
            >
              {checkoutState === 'loading' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                'Open secure checkout'
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
