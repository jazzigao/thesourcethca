import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  productId: string;
  grams: number;
  quantity: number;
  price: number;
  name: string;
  imageUrl: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, grams: number) => void;
  updateQuantity: (productId: string, grams: number, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  ageVerified: boolean;
  setAgeVerified: (verified: boolean) => void;
  jurisdictionConfirmed: boolean;
  setJurisdictionConfirmed: (confirmed: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("st-cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(() => {
    return localStorage.getItem("st-age") === "true";
  });
  const [jurisdictionConfirmed, setJurisdictionConfirmed] = useState(() => {
    return localStorage.getItem("st-jurisdiction") === "true";
  });

  useEffect(() => {
    localStorage.setItem("st-cart", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("st-age", ageVerified.toString());
  }, [ageVerified]);

  useEffect(() => {
    localStorage.setItem("st-jurisdiction", jurisdictionConfirmed.toString());
  }, [jurisdictionConfirmed]);

  const addItem = (newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === newItem.productId && i.grams === newItem.grams);
      if (existing) {
        return prev.map((i) => 
          i.productId === newItem.productId && i.grams === newItem.grams 
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }
      return [...prev, newItem];
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: string, grams: number) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.grams === grams)));
  };

  const updateQuantity = (productId: string, grams: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, grams);
      return;
    }
    setItems((prev) => 
      prev.map((i) => 
        i.productId === productId && i.grams === grams
          ? { ...i, quantity }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      cartTotal,
      isCartOpen,
      setIsCartOpen,
      ageVerified,
      setAgeVerified,
      jurisdictionConfirmed,
      setJurisdictionConfirmed
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
