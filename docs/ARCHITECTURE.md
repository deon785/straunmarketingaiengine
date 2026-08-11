# 🏗️ Architecture Documentation

## System Overview

The Straun Marketing AI Engine is a **single-page application (SPA)** built with React that communicates with **Supabase** for backend services (database, authentication, storage, and real-time features).

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    React SPA                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              App.jsx (Router)                   │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │  │
│  │  │  │ Auth     │  │ SocialAI │  │ Setup Forms  │  │  │  │
│  │  │  │ Context  │  │ Engine   │  │ (Seller/Buyer)│  │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────────┘  │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │  │
│  │  │  │ Notifica-│  │ Wishlist │  │ Chat System  │  │  │  │
│  │  │  │ tions    │  │ Manager  │  │              │  │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │          Supabase Client (lib/supabase.js)      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │   Auth   │  │ Storage  │  │Realtime  │   │
│  │Database  │  │  (JWT)   │  │ (Images) │  │WebSocket │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Edge Functions                        │     │
│  │  ┌──────────────────┐  ┌─────────────────────┐   │     │
│  │  │send-notification │  │  send-push-         │   │     │
│  │  │                  │  │  notifications      │   │     │
│  │  └──────────────────┘  └─────────────────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Authentication Flow

```
User → signup.jsx → Supabase Auth → JWT Token → AuthContext → Protected Routes
```

### 2. Search Flow (Buyer)

```
Search Input → SocialAIMarketingEngine → Supabase Query (products) → Results Display
                                                     ↓
                                               Notifications (Sellers)
```

### 3. Matching Flow

```
New Product Listing → Supabase Trigger → Check Buyer Interests → Notification → Buyer
New Buyer Interest → Supabase Trigger → Check Seller Products → Notification → Seller
```

### 4. Notification Flow

```
Database Change → Supabase Realtime → React Component → Toast/UI Update
                                     → Service Worker → Push Notification
```

## Component Hierarchy

### Main App Structure

```
App.jsx
├── AuthProvider (AuthContext)
├── Router
│   ├── Route: "/" → Auth (signup.jsx)
│   ├── Route: "/seller-decision" → SellerDecision
│   ├── Route: "/buyer-decision" → BuyerDecision
│   ├── Route: "/buyer-form" → BuyerSetupForm
│   ├── Route: "/app" → SocialAIMarketingEngine (Protected)
│   ├── Route: "/notifications" → NotificationsList (Protected)
│   ├── Route: "/privacy" → PrivacyPolicy
│   ├── Route: "/terms" → Terms
│   ├── Route: "/help" → HelpCenter
│   ├── Route: "/saved-searches" → SavedSearchesManager
│   ├── Route: "/reset-password" → ResetPassword
│   └── Route: "/admin" → SimpleAdmin
├── FeedbackButton (floating)
├── CookieBanner
└── PushNotificationHandler
```

### SocialAIMarketingEngine Structure

```
SocialAIMarketingEngine
├── Mode Selection (no mode)
│   ├── Seller Mode Button
│   └── Buyer Mode Button
├── Seller Decision (mode=seller, no profile)
│   ├── Add Products Now → SellerSetupForm
│   └── Skip For Now → Dashboard
├── Buyer Decision (mode=buyer, no profile)
│   ├── Add Interests → BuyerSetupForm
│   └── Skip For Now → Dashboard
├── Setup Forms
│   ├── SellerSetupForm
│   │   ├── Product Name
│   │   ├── Price
│   │   ├── Location
│   │   ├── Phone Number
│   │   ├── Description
│   │   └── ImageUploader
│   └── BuyerSetupForm
│       ├── Location
│       ├── Phone Number
│       └── Interests
└── Main Dashboard (profile complete)
    ├── Header (TopNavigationBar)
    ├── Search Section
    │   ├── Search Input
    │   ├── Search Button
    │   └── Results Count
    ├── Filter Panel
    │   ├── Price Range (min/max)
    │   ├── Location
    │   └── Sort By
    ├── Results Section
    │   ├── Products (Buyer Mode)
    │   │   └── Product Cards
    │   │       ├── Name, Price
    │   │       ├── Description
    │   │       ├── Image (zoomable)
    │   │       ├── Location
    │   │       ├── Phone
    │   │       ├── Save to Wishlist
    │   │       ├── WhatsApp Contact
    │   │       ├── Call
    │   │       └── SMS
    │   └── Prospects (Seller Mode)
    │       └── Prospect Cards
    │           ├── Email
    │           ├── Location (with match badge)
    │           ├── Interests
    │           ├── Save Prospect
    │           ├── WhatsApp Contact
    │           ├── Call
    │           └── SMS
    ├── Recommendations Section
    │   ├── Similar Products
    │   └── Alternative Products
    └── Floating Buttons
        ├── Dashboard
        ├── Report
        └── Filter
```

## State Management

### AuthContext (Global Authentication)

```javascript
// Provided values
{
  user: User | null,
  loading: boolean,
  error: string | null,
  isAuthenticated: boolean,
  selectedMode: 'seller' | 'buyer' | null,
  setMode: (mode) => void,
  clearAuthState: () => void
}
```

### NavigationContext

```javascript
// Provided values
{
  navigationStack: [],
  goBack: () => void,
  getPreviousPage: () => object,
  clearStack: () => void,
  resetNavigation: () => void,
  isNavigating: boolean
}
```

### Local State (SocialAIMarketingEngine)

```javascript
{
  // Search
  productSearch: string,
  searchLoading: boolean,
  searchCache: object,
  
  // Results
  productsFound: [],
  prospects: [],
  allProducts: [],
  
  // Filters
  filters: {
    minPrice: '',
    maxPrice: '',
    location: '',
    sortBy: 'newest'
  },
  
  // UI
  showWishlist: boolean,
  showDashboard: boolean,
  showDailyDeals: boolean,
  showReferralProgram: boolean,
  showPriceAlerts: boolean,
  showSavedSearches: boolean,
  showSettings: boolean,
  showToolsPanel: boolean,
  mobileMenuOpen: boolean,
  
  // Notifications
  notifications: [],
  unreadCount: number,
  
  // Other
  profileData: object | null,
  isProfileComplete: boolean,
  selectedMode: 'seller' | 'buyer' | null
}
```

## Real-time Features

### Supabase Realtime Subscriptions

1. **Notification Channel**
   - Listens for new notifications for the current user
   - Shows toast notifications in real-time
   - Updates notification count

2. **Product Match Channel**
   - Monitors new product listings
   - Checks against buyer interests
   - Sends match notifications

3. **Buyer Match Channel**
   - Monitors new buyer profiles
   - Checks against seller products
   - Sends match notifications

4. **Health Check Channel**
   - Monitors WebSocket connection
   - Reconnects on failure
   - Shows status to user

## Security

### Authentication
- JWT-based authentication via Supabase
- Session persistence with localStorage
- Protected routes with `ProtectedRoute` component

### Row Level Security (RLS)
- Profiles: Users can only read/update their own profile
- Products: Public read, sellers create/update their own
- Notifications: Users read their own
- Saved Items: Users read/update their own

### Input Sanitization
- DOMPurify for HTML content
- Custom sanitizers for:
  - Email (`sanitizeEmail`)
  - Phone (`sanitizePhone`)
  - Location (`sanitizeLocation`)
  - Product name (`sanitizeProductName`)
  - User input (`sanitizeInput`)

### Rate Limiting
- SmartRateLimiter for:
  - Contact attempts (5 per hour)
  - Profile setup (3 per day)
  - Save to wishlist (20 per hour)

## Performance Optimizations

### React Optimizations
- `React.memo` for pure components
- `useCallback` for stable functions
- `useMemo` for computed values
- Lazy loading with `React.lazy` + `Suspense`
- Error Boundaries for graceful degradation

### Search Optimizations
- Debounced search (300ms)
- Search caching (searchCache)
- Pagination (load more)
- IndexedDB for offline caching

### Asset Optimizations
- Image compression via `browser-image-compression`
- Vite build optimizations
- PWA with service worker

## Error Handling Strategy

### Levels

1. **Component Level** (ErrorBoundary.jsx)
   - Catches render errors
   - Shows fallback UI
   - Reports to Sentry

2. **Global Level** (GlobalErrorHandler.jsx)
   - Catches unhandled errors
   - Logs to console
   - Reports to Sentry

3. **API Level** (errorTracker.js)
   - Tracks API errors
   - Retries with exponential backoff
   - Shows user-friendly messages

4. **User Level** (toast notifications)
   - Shows success/error messages
   - Non-blocking feedback
   - Auto-dismiss after 5 seconds

### Retry Logic

```javascript
// queryWithRetry - Supabase queries
// fetchWithRetry - General fetch
// retry with exponential backoff:
// Attempt 1: 1000ms delay
// Attempt 2: 2000ms delay
// Attempt 3: 4000ms delay
// Max: 5000ms
```

## Offline Support

### Service Worker (sw.js)
- Caches static assets
- Enables offline mode
- Handles push notifications

### Offline Detection
- `navigator.onLine` checks
- Offline banner display
- Graceful degradation
- Sync when online

## Testing Strategy

### Current Status
- No automated tests currently configured
- Manual testing performed

### Recommended Tests
1. **Unit Tests**: React components with Jest + React Testing Library
2. **Integration Tests**: Supabase interactions
3. **E2E Tests**: Cypress for critical user flows
4. **Performance Tests**: Lighthouse

## Deployment Architecture

### Frontend (Vercel)
- Static hosting
- CDN distribution
- Environment variables
- Automatic SSL

### Backend (Supabase)
- Managed PostgreSQL
- Built-in authentication
- Storage for images
- Edge Functions

### Monitoring
- Sentry for errors
- Google Analytics for usage
- Supabase logs for database
- Custom error tracking

## CI/CD Pipeline

### GitHub Actions (Recommended)
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run test
      - deploy: to Vercel/Netlify
```

## Future Improvements

1. **Chat System**: Full in-app messaging with real-time
2. **AI Recommendations**: Advanced ML-based suggestions
3. **Payment Integration**: Stripe/PayPal for transactions
4. **Rating System**: User reviews and ratings
5. **Analytics Dashboard**: Advanced seller analytics
6. **Mobile Apps**: React Native versions
7. **Multi-language**: i18n support
