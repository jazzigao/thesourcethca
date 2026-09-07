import { lazy, Suspense, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CartProvider, useCart } from '@/store/cart';
import { AgeGate } from '@/components/shared/AgeGate';
import { Shell } from '@/components/layout/Shell';
import Home from '@/pages/Home';

import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const Shop = lazy(() => import('@/pages/Shop'));
const Account = lazy(() => import('@/pages/Account'));
const Wholesale = lazy(() => import('@/pages/Wholesale'));
const Reviews = lazy(() => import('@/pages/Reviews'));
const Admin = lazy(() => import('@/pages/Admin'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Suspense
        fallback={
          <div
            className="min-h-[70vh] flex items-center justify-center text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Loading page…
          </div>
        }
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/shop" component={Shop} />
          <Route path="/account" component={Account} />
          <Route path="/wholesale" component={Wholesale} />
          <Route path="/reviews" component={Reviews} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppContent() {
  return (
    <RoutedErrorBoundary>
      <AgeGate />
      <Router />
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
