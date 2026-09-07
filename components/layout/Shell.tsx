import React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartDrawer } from "../cart/CartDrawer";
import { BackToTop } from "./BackToTop";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-page-canvas min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="site-main flex-1 pt-3 sm:pt-5 pb-8 w-full max-w-6xl mx-auto px-[14px] sm:px-4 lg:px-5 relative z-10">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <BackToTop />
    </div>
  );
}
