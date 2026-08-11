// generate-docs.js
// Run this with: node generate-docs.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create docs folder
const docsDir = path.join(__dirname, 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

// ============================================================
// 1. README.md
// ============================================================
const readmeContent = `# 🚀 Straun Marketing AI Engine

> AI-powered social marketplace connecting buyers and sellers through intelligent matching

## 📖 Overview

Straun Marketing AI Engine is a **full-stack social marketplace** that uses AI to match buyers with sellers based on interests, search behavior, and product listings. The platform enables:

- **Sellers** to list products and find interested buyers
- **Buyers** to search products and get AI-powered recommendations
- **Real-time notifications** for matches and price drops
- **WhatsApp integration** for instant communication

## ✨ Features

### 🔐 Authentication
- Email/Password signup & signin
- Phone number (optional)
- Password reset
- Session persistence with Supabase

### 👤 User Modes

| Mode | Features |
|------|----------|
| **Seller** | List products, find prospects, view analytics |
| **Buyer** | Search products, set interests, get recommendations |

### 🎯 Core Features

- **Product Listing** - Upload with images, set price & location
- **Smart Search** - Product search with filters (price, location, sort)
- **AI Matching** - Interest-based matching between buyers & sellers
- **Real-time Notifications** - WebSocket + Push notifications
- **Wishlist** - Save products and prospects with reminders
- **Referral Program** - Earn points by inviting friends
- **Daily Deals** - Curated deals of the day
- **Price Alerts** - Get notified when prices drop
- **Chat System** - In-app messaging (coming soon)
- **Admin Dashboard** - Analytics and user management

## 🛠️ Tech Stack

### Frontend
- **React 19** with Hooks & Context API
- **React Router v7** for navigation
- **React Hook Form** for form management
- **Vite** for build tooling
- **PWA** with offline support

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Real-time subscriptions** for live updates
- **Edge Functions** for push notifications

### Analytics & Monitoring
- **Google Analytics 4** (react-ga4)
- **Sentry** for error tracking

### Styling
- **Custom CSS** with responsive design
- **Font Awesome** icons

## 📦 Installation

### Prerequisites
- Node.js v18+
- npm or yarn
- Supabase account (free tier)

### Setup

1. **Clone the repository**
\`\`\`bash
git clone https://github.com/yourusername/social-ai-marketing-app.git
cd social-ai-marketing-app
\`\`\`

2. **Install dependencies**
\`\`\`bash
npm install
\`\`\`

3. **Set up environment variables**
\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` with your credentials:
\`\`\`env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GA_TRACKING_ID=your_ga_tracking_id
VITE_SENTRY_DSN=your_sentry_dsn
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
\`\`\`

4. **Run development server**
\`\`\`bash
npm run dev
\`\`\`

5. **Build for production**
\`\`\`bash
npm run build
npm run preview
\`\`\`

## 🗄️ Database Schema

### Core Tables

\`\`\`sql
-- profiles: User profiles with roles and preferences
profiles (
  user_id UUID PRIMARY KEY,
  username TEXT,
  email TEXT,
  phone_number TEXT,
  location TEXT,
  interests JSONB,
  is_seller BOOLEAN,
  is_buyer BOOLEAN,
  seller_setup_completed BOOLEAN,
  buyer_setup_completed BOOLEAN,
  referral_code TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- products: Product listings from sellers
products (
  id UUID PRIMARY KEY,
  seller_id UUID REFERENCES profiles(user_id),
  name TEXT,
  price NUMERIC,
  description TEXT,
  location TEXT,
  phone_number TEXT,
  image_url TEXT,
  status TEXT,
  views INTEGER,
  sold BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- notifications: User notifications
notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  sender_id UUID,
  product_id UUID REFERENCES products(id),
  message TEXT,
  link_type TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMP
)

-- saved_items: Wishlist items
saved_items (
  id UUID PRIMARY KEY,
  user_id UUID,
  product_id UUID,
  prospect_id UUID,
  item_type TEXT,
  product_name TEXT,
  product_price NUMERIC,
  product_image TEXT,
  seller_location TEXT,
  seller_phone TEXT,
  created_at TIMESTAMP
)

-- saved_searches: User saved searches
saved_searches (
  id UUID PRIMARY KEY,
  user_id UUID,
  search_term TEXT,
  min_price NUMERIC,
  max_price NUMERIC,
  location TEXT,
  is_active BOOLEAN,
  last_notified_at TIMESTAMP,
  created_at TIMESTAMP
)

-- referrals: Referral tracking
referrals (
  id UUID PRIMARY KEY,
  referrer_id UUID,
  referred_user_id UUID,
  referral_code TEXT,
  status TEXT,
  points_earned INTEGER,
  completed_at TIMESTAMP,
  created_at TIMESTAMP
)

-- price_alerts: Price drop notifications
price_alerts (
  id UUID PRIMARY KEY,
  user_id UUID,
  product_id UUID,
  target_price NUMERIC,
  current_price NUMERIC,
  is_active BOOLEAN,
  created_at TIMESTAMP
)
\`\`\`

## 🏗️ Project Structure

\`\`\`
social-ai-marketing-app/
├── public/                 # Static assets
│   ├── Straun-logo.png
│   ├── favicon.ico
│   ├── manifest.json       # PWA manifest
│   └── sw.js              # Service Worker
├── src/
│   ├── lib/               # Supabase client & utilities
│   │   ├── supabase.js
│   │   └── resilientSupabase.js
│   ├── hooks/             # Custom React hooks
│   │   ├── useBouncer.js
│   │   └── useSupabaseQuery.js
│   ├── utils/             # Utility functions
│   │   └── errorRecovery.js
│   ├── App.jsx            # Main app with routing
│   ├── App.css            # Global styles
│   ├── AuthContext.jsx    # Authentication state
│   ├── NavigationContext.jsx # Navigation management
│   ├── signup.jsx         # Login/Signup page
│   ├── SocialAIMarketingEngine.jsx # Main dashboard
│   ├── SellerSetupForm.jsx # Seller profile setup
│   ├── BuyerSetupForm.jsx # Buyer interests setup
│   ├── SellerDecision.jsx # Seller mode decision
│   ├── BuyerDecision.jsx  # Buyer mode decision
│   ├── UserDashboard.jsx  # User dashboard
│   ├── UserSettings.jsx   # User settings
│   ├── UserSettings.css   # Settings styles
│   ├── Signup.css         # Auth styles
│   ├── SellerDecision.css # Seller decision styles
│   ├── index.css          # Base styles
│   ├── main.jsx           # Entry point
│   ├── [Components...]    # All feature components
│   └── *.css              # Component styles
├── docs/                  # Documentation (generated)
├── scripts/               # Utility scripts
├── index.html
├── package.json
├── vite.config.js
└── .env                   # Environment variables
\`\`\`

## 🚀 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Deploy to Netlify

1. Push code to GitHub
2. Import project in Netlify
3. Add environment variables
4. Deploy

### Supabase Setup

1. Create Supabase project
2. Run migration SQL
3. Set up RLS policies
4. Configure Storage bucket for images

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| \`VITE_SUPABASE_URL\` | Supabase project URL | ✅ |
| \`VITE_SUPABASE_ANON_KEY\` | Supabase anonymous key | ✅ |
| \`VITE_GA_TRACKING_ID\` | Google Analytics ID | ❌ |
| \`VITE_SENTRY_DSN\` | Sentry DSN for error tracking | ❌ |
| \`VITE_VAPID_PUBLIC_KEY\` | VAPID key for push notifications | ❌ |

## 📱 PWA Support

The app is a **Progressive Web App** with:
- Offline support via Service Worker
- Push notifications
- Home screen installation
- Full-screen experience

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 🙏 Support

For support, email deonmahachi8@gmail.com or open an issue.

---

**Built with ❤️ using React + Supabase**
`;

// ============================================================
// 2. ARCHITECTURE.md
// ============================================================
const architectureContent = `# 🏗️ Architecture Documentation

## System Overview

The Straun Marketing AI Engine is a **single-page application (SPA)** built with React that communicates with **Supabase** for backend services (database, authentication, storage, and real-time features).

### Architecture Diagram

\`\`\`
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
\`\`\`

## Data Flow

### 1. Authentication Flow

\`\`\`
User → signup.jsx → Supabase Auth → JWT Token → AuthContext → Protected Routes
\`\`\`

### 2. Search Flow (Buyer)

\`\`\`
Search Input → SocialAIMarketingEngine → Supabase Query (products) → Results Display
                                                     ↓
                                               Notifications (Sellers)
\`\`\`

### 3. Matching Flow

\`\`\`
New Product Listing → Supabase Trigger → Check Buyer Interests → Notification → Buyer
New Buyer Interest → Supabase Trigger → Check Seller Products → Notification → Seller
\`\`\`

### 4. Notification Flow

\`\`\`
Database Change → Supabase Realtime → React Component → Toast/UI Update
                                     → Service Worker → Push Notification
\`\`\`

## Component Hierarchy

### Main App Structure

\`\`\`
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
\`\`\`

### SocialAIMarketingEngine Structure

\`\`\`
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
\`\`\`

## State Management

### AuthContext (Global Authentication)

\`\`\`javascript
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
\`\`\`

### NavigationContext

\`\`\`javascript
// Provided values
{
  navigationStack: [],
  goBack: () => void,
  getPreviousPage: () => object,
  clearStack: () => void,
  resetNavigation: () => void,
  isNavigating: boolean
}
\`\`\`

### Local State (SocialAIMarketingEngine)

\`\`\`javascript
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
\`\`\`

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
- Protected routes with \`ProtectedRoute\` component

### Row Level Security (RLS)
- Profiles: Users can only read/update their own profile
- Products: Public read, sellers create/update their own
- Notifications: Users read their own
- Saved Items: Users read/update their own

### Input Sanitization
- DOMPurify for HTML content
- Custom sanitizers for:
  - Email (\`sanitizeEmail\`)
  - Phone (\`sanitizePhone\`)
  - Location (\`sanitizeLocation\`)
  - Product name (\`sanitizeProductName\`)
  - User input (\`sanitizeInput\`)

### Rate Limiting
- SmartRateLimiter for:
  - Contact attempts (5 per hour)
  - Profile setup (3 per day)
  - Save to wishlist (20 per hour)

## Performance Optimizations

### React Optimizations
- \`React.memo\` for pure components
- \`useCallback\` for stable functions
- \`useMemo\` for computed values
- Lazy loading with \`React.lazy\` + \`Suspense\`
- Error Boundaries for graceful degradation

### Search Optimizations
- Debounced search (300ms)
- Search caching (searchCache)
- Pagination (load more)
- IndexedDB for offline caching

### Asset Optimizations
- Image compression via \`browser-image-compression\`
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

\`\`\`javascript
// queryWithRetry - Supabase queries
// fetchWithRetry - General fetch
// retry with exponential backoff:
// Attempt 1: 1000ms delay
// Attempt 2: 2000ms delay
// Attempt 3: 4000ms delay
// Max: 5000ms
\`\`\`

## Offline Support

### Service Worker (sw.js)
- Caches static assets
- Enables offline mode
- Handles push notifications

### Offline Detection
- \`navigator.onLine\` checks
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

### Frontend (Vercel/Netlify)
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
\`\`\`yaml
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
\`\`\`

## Future Improvements

1. **Chat System**: Full in-app messaging with real-time
2. **AI Recommendations**: Advanced ML-based suggestions
3. **Payment Integration**: Stripe/PayPal for transactions
4. **Rating System**: User reviews and ratings
5. **Analytics Dashboard**: Advanced seller analytics
6. **Mobile Apps**: React Native versions
7. **Multi-language**: i18n support
`;

// ============================================================
// 3. API.md
// ============================================================
const apiContent = `# 📡 API Documentation

## Supabase Client

The app uses **Supabase** as the backend with a custom client wrapper in \`lib/supabase.js\`.

### Client Initialization

\`\`\`javascript
import { supabase } from './lib/supabase';

// Already configured with:
// - Persist session
// - Auto-refresh token
// - Realtime parameters
\`\`\`

---

## Authentication API

### Sign Up

\`\`\`javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: { phone: '+263712345678' },
    emailRedirectTo: 'https://yourapp.com/app'
  }
});
\`\`\`

### Sign In

\`\`\`javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});
\`\`\`

### Sign Out

\`\`\`javascript
const { error } = await supabase.auth.signOut();
\`\`\`

### Get Current User

\`\`\`javascript
const { data: { user }, error } = await supabase.auth.getUser();
\`\`\`

### Get Session

\`\`\`javascript
const { data: { session }, error } = await supabase.auth.getSession();
\`\`\`

### Reset Password

\`\`\`javascript
const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: 'https://yourapp.com/reset-password'
});
\`\`\`

---

## Profiles API

### Get Profile

\`\`\`javascript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();
\`\`\`

### Update Profile

\`\`\`javascript
const { data, error } = await supabase
  .from('profiles')
  .update({
    location: 'Harare',
    phone_number: '+263712345678',
    is_seller: true,
    seller_setup_completed: true,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId);
\`\`\`

### Upsert Profile

\`\`\`javascript
const { data, error } = await supabase
  .from('profiles')
  .upsert({
    user_id: userId,
    username: 'john_doe',
    location: 'Harare',
    // ... other fields
  }, { onConflict: 'user_id' });
\`\`\`

---

## Products API

### List Products

\`\`\`javascript
// Basic query
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false });

// With filters
let query = supabase.from('products').select('*');
query = query.gte('price', 10);
query = query.lte('price', 100);
query = query.ilike('location', '%Harare%');
const { data, error } = await query;
\`\`\`

### Search Products

\`\`\`javascript
const { data, error } = await supabase
  .from('products')
  .select(\`
    id,
    name,
    price,
    location,
    description,
    phone_number,
    seller_id,
    created_at,
    image_url,
    profiles:seller_id (
      user_id,
      username,
      location,
      phone_number
    )
  \`)
  .ilike('name', '%search_term%')
  .neq('seller_id', userId)
  .limit(50);
\`\`\`

### Create Product

\`\`\`javascript
const { data, error } = await supabase
  .from('products')
  .insert([{
    seller_id: userId,
    name: 'Product Name',
    price: 49.99,
    description: 'Product description',
    location: 'Harare',
    phone_number: '+263712345678',
    image_url: 'https://...',
    status: 'active',
    created_at: new Date().toISOString()
  }])
  .select();
\`\`\`

### Update Product

\`\`\`javascript
const { data, error } = await supabase
  .from('products')
  .update({
    name: 'New Name',
    price: 59.99,
    updated_at: new Date().toISOString()
  })
  .eq('id', productId);
\`\`\`

### Increment Views

\`\`\`javascript
const { error } = await supabase.rpc('increment_product_views', {
  p_product_id: productId
});
\`\`\`

### Get Similar Products

\`\`\`javascript
const { data, error } = await supabase
  .from('product_similarity')
  .select(\`
    product_id_2,
    similarity_score,
    products:product_id_2 (
      id,
      name,
      price,
      location,
      description,
      image_url
    )
  \`)
  .eq('product_id_1', productId)
  .order('similarity_score', { ascending: false })
  .limit(6);
\`\`\`

---

## Notifications API

### Get Notifications

\`\`\`javascript
const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50);
\`\`\`

### Create Notification

\`\`\`javascript
const { data, error } = await supabase
  .from('notifications')
  .insert([{
    user_id: targetUserId,
    sender_id: currentUserId,
    product_id: productId,
    message: 'New match found!',
    link_type: 'product_match',
    is_read: false,
    created_at: new Date().toISOString()
  }]);
\`\`\`

### Mark as Read

\`\`\`javascript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('id', notificationId);
\`\`\`

### Mark All as Read

\`\`\`javascript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', userId)
  .eq('is_read', false);
\`\`\`

---

## Saved Items (Wishlist) API

### Get Saved Items

\`\`\`javascript
const { data, error } = await supabase
  .from('saved_items')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
\`\`\`

### Save Item

\`\`\`javascript
const { data, error } = await supabase
  .from('saved_items')
  .insert([{
    user_id: userId,
    product_id: productId,
    item_type: 'product',
    product_name: 'Product Name',
    product_price: 49.99,
    product_image: 'https://...',
    seller_location: 'Harare',
    seller_phone: '+263712345678',
    created_at: new Date().toISOString()
  }]);
\`\`\`

### Remove Saved Item

\`\`\`javascript
const { error } = await supabase
  .from('saved_items')
  .delete()
  .eq('id', savedItemId);
\`\`\`

### Check if Saved

\`\`\`javascript
const { data, error } = await supabase
  .from('saved_items')
  .select('id')
  .eq('user_id', userId)
  .eq('product_id', productId)
  .maybeSingle();
\`\`\`

---

## Saved Searches API

### Get Saved Searches

\`\`\`javascript
const { data, error } = await supabase
  .from('saved_searches')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
\`\`\`

### Save Search

\`\`\`javascript
const { data, error } = await supabase
  .from('saved_searches')
  .insert([{
    user_id: userId,
    search_term: 'iPhone',
    min_price: 100,
    max_price: 500,
    location: 'Harare',
    is_active: true,
    created_at: new Date().toISOString()
  }]);
\`\`\`

### Delete Saved Search

\`\`\`javascript
const { error } = await supabase
  .from('saved_searches')
  .delete()
  .eq('id', searchId);
\`\`\`

---

## Referrals API

### Create Referral

\`\`\`javascript
const { data, error } = await supabase
  .from('referrals')
  .insert([{
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    referral_code: 'ABC123',
    status: 'completed',
    points_earned: 50,
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }]);
\`\`\`

### Get Referral Count

\`\`\`javascript
const { data, error } = await supabase
  .from('referrals')
  .select('id', { count: 'exact' })
  .eq('referrer_id', userId)
  .eq('status', 'completed');
\`\`\`

### Get Referral Code

\`\`\`javascript
const { data, error } = await supabase
  .from('profiles')
  .select('referral_code')
  .eq('user_id', userId)
  .maybeSingle();
\`\`\`

---

## Price Alerts API

### Create Alert

\`\`\`javascript
const { data, error } = await supabase
  .from('price_alerts')
  .insert([{
    user_id: userId,
    product_id: productId,
    target_price: 50,
    current_price: 100,
    is_active: true,
    created_at: new Date().toISOString()
  }]);
\`\`\`

### Get Alerts

\`\`\`javascript
const { data, error } = await supabase
  .from('price_alerts')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true);
\`\`\`

### Deactivate Alert

\`\`\`javascript
const { error } = await supabase
  .from('price_alerts')
  .update({ is_active: false })
  .eq('id', alertId);
\`\`\`

---

## Push Notifications API

### Subscribe to Push

\`\`\`javascript
const result = await callEdgeFunction('send-push-notifications', {
  action: 'subscribe',
  subscription: pushSubscription,
  userId: userId,
  userAgent: navigator.userAgent
});
\`\`\`

### Send Notification

\`\`\`javascript
const result = await callEdgeFunction('send-push-notifications', {
  userId: userId,
  title: 'New Match!',
  body: 'Someone is interested in your product',
  icon: '/pwa-192x192.png',
  url: '/app'
});
\`\`\`

### Test Notification

\`\`\`javascript
const registration = await navigator.serviceWorker.ready;
registration.showNotification('Test Notification', {
  body: '✅ Push notifications are working!',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  vibrate: [200, 100, 200]
});
\`\`\`

---

## Helper Functions

### queryWithRetry

Retry failed Supabase queries with exponential backoff.

\`\`\`javascript
const result = await queryWithRetry(async () => {
  return await supabase
    .from('products')
    .select('*')
    .limit(10);
}, 3); // max 3 retries
\`\`\`

### callEdgeFunction

Call Supabase Edge Function with retry and timeout.

\`\`\`javascript
const result = await callEdgeFunction('send-notification', {
  userId: userId,
  message: 'Hello!'
}, {
  retries: 3,
  timeout: 15000
});
\`\`\`

### sendPushNotification

Send push notification with retry logic.

\`\`\`javascript
const result = await sendPushNotification(userId, {
  title: 'New Notification',
  body: 'You have a new match!',
  url: '/app'
}, {
  retries: 2,
  retryDelay: 2000
});
\`\`\`

### resilientSelect

Safe select with retry.

\`\`\`javascript
const { data, error } = await resilientSelect('products', '*', {
  status: 'active',
  seller_id: userId
});
\`\`\`

---

## Error Response Format

All functions return consistent error objects:

\`\`\`javascript
// Success
{
  data: [...],
  error: null
}

// Error
{
  data: null,
  error: {
    message: 'Error message',
    code: 'ERROR_CODE',
    details: 'Additional details'
  }
}
\`\`\`

## Error Codes

| Code | Description |
|------|-------------|
| \`42501\` | Permission denied (RLS) |
| \`23502\` | Missing required fields |
| \`22P02\` | Invalid data type |
| \`23505\` | Duplicate entry |
| \`PGRST116\` | No rows returned |
| \`401\` | Unauthorized (invalid JWT) |
| \`404\` | Not found |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Contact attempts | 5 | 1 hour |
| Profile setup | 3 | 1 day |
| Save to wishlist | 20 | 1 hour |
| Search queries | 100 | 1 hour |
| Image uploads | 10 | 1 hour |
`;

// ============================================================
// 4. DATABASE.md
// ============================================================
const databaseContent = `# 🗄️ Database Schema

## Overview

The app uses **PostgreSQL** managed by **Supabase**. The database is designed for a social marketplace with buyer/seller matching, real-time notifications, and analytics.

---

## Table Definitions

### 1. profiles

User profiles with roles, settings, and preferences.

\`\`\`sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  phone_number TEXT,
  location TEXT,
  interests JSONB DEFAULT '[]',
  is_seller BOOLEAN DEFAULT false,
  is_buyer BOOLEAN DEFAULT false,
  seller_setup_completed BOOLEAN DEFAULT false,
  buyer_setup_completed BOOLEAN DEFAULT false,
  referral_code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_location ON profiles(location);
CREATE INDEX idx_profiles_is_seller ON profiles(is_seller);
CREATE INDEX idx_profiles_is_buyer ON profiles(is_buyer);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
\`\`\`

**Fields:**
- \`user_id\`: Primary key, links to auth.users
- \`username\`: Display name
- \`email\`: User email
- \`phone_number\`: Contact number (international format)
- \`location\`: City/area
- \`interests\`: JSON array of product interests (buyers)
- \`is_seller\`: True for seller mode
- \`is_buyer\`: True for buyer mode
- \`seller_setup_completed\`: Seller setup complete
- \`buyer_setup_completed\`: Buyer setup complete
- \`referral_code\`: Unique code for referrals
- \`is_active\`: Soft delete flag
- \`created_at\`: Timestamp
- \`updated_at\`: Timestamp

---

### 2. products

Product listings created by sellers.

\`\`\`sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  location TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive')),
  views INTEGER DEFAULT 0,
  sold BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_location ON products(location);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at);
\`\`\`

**Fields:**
- \`id\`: Primary key
- \`seller_id\`: Reference to profiles
- \`name\`: Product name (max 200 chars)
- \`price\`: Price in USD (max 999999.99)
- \`description\`: Product description (max 1000 chars)
- \`location\`: Seller's location
- \`phone_number\`: Seller's contact
- \`image_url\`: Product image URL
- \`status\`: active | sold | inactive
- \`views\`: View count
- \`sold\`: Flag for sold status
- \`created_at\`: Timestamp
- \`updated_at\`: Timestamp

---

### 3. notifications

User notifications for matches, messages, and alerts.

\`\`\`sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(user_id),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  link_type TEXT,
  is_read BOOLEAN DEFAULT false,
  buyer_phone TEXT,
  product_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
\`\`\`

**Fields:**
- \`id\`: Primary key
- \`user_id\`: Recipient
- \`sender_id\`: Who triggered the notification
- \`product_id\`: Related product
- \`message\`: Notification text
- \`link_type\`: Type of notification (search_match, product_match, etc.)
- \`is_read\`: Read status
- \`buyer_phone\`: Buyer's phone (for matching)
- \`product_image\`: Product image (for display)
- \`created_at\`: Timestamp

---

### 4. saved_items (Wishlist)

Items saved by users to their wishlist.

\`\`\`sql
CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  prospect_id UUID,
  item_type TEXT CHECK (item_type IN ('product', 'prospect')),
  product_name TEXT,
  product_price NUMERIC(10,2),
  product_image TEXT,
  seller_location TEXT,
  seller_phone TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  interested_in TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_items_user_id ON saved_items(user_id);
CREATE INDEX idx_saved_items_product_id ON saved_items(product_id);
CREATE INDEX idx_saved_items_item_type ON saved_items(item_type);
\`\`\`

**Fields:**
- \`id\`: Primary key
- \`user_id\`: User who saved
- \`product_id\`: Product ID (if product type)
- \`prospect_id\`: Prospect ID (if prospect type)
- \`item_type\`: product | prospect
- \`product_name\`: Snapshot of product name
- \`product_price\`: Snapshot of product price
- \`product_image\`: Snapshot of product image
- \`seller_location\`: Snapshot of seller location
- \`seller_phone\`: Snapshot of seller phone
- \`prospect_email\`: Prospect email (snapshot)
- \`prospect_phone\`: Prospect phone (snapshot)
- \`interested_in\`: What prospect is interested in
- \`created_at\`: Timestamp

---

### 5. saved_searches

Saved search queries for monitoring.

\`\`\`sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_term ON saved_searches(search_term);
\`\`\`

---

### 6. referrals

Referral tracking for the referral program.

\`\`\`sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  points_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
\`\`\`

---

### 7. referral_rewards

Points earned from referrals.

\`\`\`sql
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  points_earned INTEGER NOT NULL CHECK (points_earned >= 0),
  reward_type TEXT CHECK (reward_type IN ('referral', 'signup_bonus', 'daily_deal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referral_rewards_user_id ON referral_rewards(user_id);
\`\`\`

---

### 8. price_alerts

Price drop alerts for products.

\`\`\`sql
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price NUMERIC(10,2) NOT NULL,
  current_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_product_id ON price_alerts(product_id);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active);
\`\`\`

---

### 9. push_subscriptions

Push notification subscriptions for web.

\`\`\`sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  device_info TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
\`\`\`

---

### 10. searches

Search analytics.

\`\`\`sql
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  seller_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  product_name TEXT,
  search_type TEXT CHECK (search_type IN ('product', 'prospect')),
  prospects_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_searches_buyer_id ON searches(buyer_id);
CREATE INDEX idx_searches_seller_id ON searches(seller_id);
CREATE INDEX idx_searches_created_at ON searches(created_at);
\`\`\`

---

### 11. feedback

User feedback submissions.

\`\`\`sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
\`\`\`

---

### 12. product_similarity

Product similarity recommendations (optional).

\`\`\`sql
CREATE TABLE product_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_1 UUID REFERENCES products(id) ON DELETE CASCADE,
  product_id_2 UUID REFERENCES products(id) ON DELETE CASCADE,
  similarity_score NUMERIC(3,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id_1, product_id_2)
);

-- Indexes
CREATE INDEX idx_similarity_product_1 ON product_similarity(product_id_1);
CREATE INDEX idx_similarity_product_2 ON product_similarity(product_id_2);
CREATE INDEX idx_similarity_score ON product_similarity(similarity_score);
\`\`\`

---

## Row Level Security (RLS) Policies

### Profiles

\`\`\`sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
\`\`\`

### Products

\`\`\`sql
-- Anyone can read active products
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  USING (status = 'active');

-- Sellers can read their own products
CREATE POLICY "Sellers can read own products"
  ON products FOR SELECT
  USING (auth.uid() = seller_id);

-- Sellers can insert products
CREATE POLICY "Sellers can insert products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own products
CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  USING (auth.uid() = seller_id);

-- Sellers can delete their own products
CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  USING (auth.uid() = seller_id);
\`\`\`

### Notifications

\`\`\`sql
-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
\`\`\`

### Saved Items

\`\`\`sql
-- Users can read their own saved items
CREATE POLICY "Users can read own saved items"
  ON saved_items FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved items
CREATE POLICY "Users can insert own saved items"
  ON saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own saved items
CREATE POLICY "Users can update own saved items"
  ON saved_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own saved items
CREATE POLICY "Users can delete own saved items"
  ON saved_items FOR DELETE
  USING (auth.uid() = user_id);
\`\`\`

---

## Database Functions

### increment_product_views

\`\`\`sql
CREATE OR REPLACE FUNCTION increment_product_views(p_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET views = views + 1
  WHERE id = p_product_id;
END;
$$;
\`\`\`

### track_user_activity

\`\`\`sql
CREATE OR REPLACE FUNCTION track_user_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_metadata JSONB,
  p_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Your activity tracking logic
  INSERT INTO user_activity_logs (user_id, activity_type, metadata, message, created_at)
  VALUES (p_user_id, p_activity_type, p_metadata, p_message, NOW());
END;
$$;
\`\`\`

### get_user_matches

\`\`\`sql
-- Get matches for a user based on interests/products
CREATE OR REPLACE FUNCTION get_user_matches(p_user_id UUID)
RETURNS TABLE(
  matched_user_id UUID,
  match_type TEXT,
  match_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Your matching logic here
  ;
END;
$$;
\`\`\`

---

## Views

### user_notification_count

\`\`\`sql
CREATE OR REPLACE VIEW user_notification_count AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
  COUNT(*) AS total_count
FROM notifications
GROUP BY user_id;
\`\`\`

### product_with_seller

\`\`\`sql
CREATE OR REPLACE VIEW product_with_seller AS
SELECT 
  p.*,
  pr.username AS seller_username,
  pr.location AS seller_location,
  pr.phone_number AS seller_phone
FROM products p
LEFT JOIN profiles pr ON p.seller_id = pr.user_id
WHERE p.status = 'active';
\`\`\`

---

## Triggers

### update_updated_at

\`\`\`sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ... other tables
\`\`\`

### referral_code_on_insert

\`\`\`sql
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_code TEXT;
  random_suffix TEXT;
BEGIN
  -- Generate code from email
  base_code := UPPER(SUBSTRING(SPLIT_PART(NEW.email, '@', 1), 1, 6));
  random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
  NEW.referral_code := base_code || random_suffix;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();
\`\`\`

---

## Migration Script

### Initial Setup

\`\`\`sql
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (in order)
-- 1. profiles
-- 2. products
-- 3. notifications
-- 4. saved_items
-- 5. saved_searches
-- 6. referrals
-- 7. referral_rewards
-- 8. price_alerts
-- 9. push_subscriptions
-- 10. searches
-- 11. feedback

-- Create all functions
-- Create all triggers
-- Create all policies
\`\`\`

---

## Data Relationships

\`\`\`
auth.users
  ↓
profiles (user_id)
  ↓
products (seller_id → profiles.user_id)
  ↓
notifications (user_id → profiles.user_id)
saved_items (user_id → profiles.user_id)
saved_searches (user_id → profiles.user_id)
referrals (referrer_id → profiles.user_id)
push_subscriptions (user_id → profiles.user_id)

products
  ↓
notifications (product_id → products.id)
saved_items (product_id → products.id)
price_alerts (product_id → products.id)
\`\`\`

---

## Sample Queries

### Get Products with Seller Info

\`\`\`sql
SELECT 
  p.*,
  pr.username,
  pr.location as seller_location,
  pr.phone_number as seller_phone
FROM products p
LEFT JOIN profiles pr ON p.seller_id = pr.user_id
WHERE p.status = 'active'
  AND p.location ILIKE '%Harare%'
  AND p.price BETWEEN 10 AND 100
ORDER BY p.created_at DESC
LIMIT 50;
\`\`\`

### Get Unread Notifications Count

\`\`\`sql
SELECT COUNT(*) as unread_count
FROM notifications
WHERE user_id = 'user-uuid'
  AND is_read = false;
\`\`\`

### Get Matching Buyers for a Product

\`\`\`sql
SELECT DISTINCT pr.user_id, pr.username, pr.interests
FROM profiles pr
WHERE pr.is_buyer = true
  AND pr.is_active = true
  AND pr.interests @> '[{"name": "iPhone"}]';
\`\`\`

### Get Saved Items with Product Details

\`\`\`sql
SELECT 
  si.*,
  p.name as current_product_name,
  p.price as current_product_price,
  p.image_url as current_product_image
FROM saved_items si
LEFT JOIN products p ON si.product_id = p.id
WHERE si.user_id = 'user-uuid'
  AND si.item_type = 'product'
ORDER BY si.created_at DESC;
\`\`\`

---

## Database Maintenance

### Vacuum

\`\`\`sql
-- Regular vacuum
VACUUM ANALYZE profiles;
VACUUM ANALYZE products;
VACUUM ANALYZE notifications;

-- Or all tables
VACUUM ANALYZE;
\`\`\`

### Index Maintenance

\`\`\`sql
-- Reindex
REINDEX INDEX idx_products_name;
REINDEX INDEX idx_notifications_user_id;
\`\`\`

### Cleanup

\`\`\`sql
-- Delete old notifications (older than 30 days)
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete inactive alerts
DELETE FROM price_alerts
WHERE is_active = false
  AND created_at < NOW() - INTERVAL '90 days';
\`\`\`
`;

// ============================================================
// 5. COMPONENTS.md
// ============================================================
const componentsContent = `# 🧩 Component Documentation

## Core Components

### App.jsx

The root component that sets up routing, providers, and global configuration.

**Props:** None

**Context Used:**
- AuthContext (user, loading, isAuthenticated)
- NavigationContext

**Key Features:**
- React Router setup
- Lazy loading with Suspense
- Global Error Boundary
- Analytics tracking
- Offline detection
- Notification watcher
- Protected routes

**Structure:**
\`\`\`jsx
<GlobalErrorHandler>
  <Router>
    <NavigationProvider>
      <Suspense>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/app" element={<ProtectedRoute><SocialAIMarketingEngine /></ProtectedRoute>} />
          {/* ... more routes */}
        </Routes>
      </Suspense>
    </NavigationProvider>
  </Router>
</GlobalErrorHandler>
\`\`\`

---

### signup.jsx (Auth Page)

The authentication page with signup and signin.

**Props:** None

**State:**
- \`loading\`: Boolean for submission status
- \`isSignUp\`: Boolean toggle signup/signin
- \`message\`: { text, type } for feedback

**Features:**
- Email/password signup
- Optional phone number
- Terms & Privacy agreement
- Password visibility toggle
- Form validation
- Referral code support
- Auto-login after signup

**Key Functions:**
- \`handleSignUp()\` - Creates new account
- \`handleSignIn()\` - Logs in user
- \`handleForgotPassword()\` - Sends reset email

---

### SocialAIMarketingEngine.jsx

The main application dashboard. **This is the largest component.**

**Props:** None

**State Management:**
\`\`\`javascript
// Search
const [productSearch, setProductSearch] = useState('');
const [searchLoading, setSearchLoading] = useState(false);
const [searchCache, setSearchCache] = useState({});

// Results
const [productsFound, setProductsFound] = useState([]);
const [prospects, setProspects] = useState([]);
const [allProducts, setAllProducts] = useState([]);

// UI
const [showWishlist, setShowWishlist] = useState(false);
const [showDashboard, setShowDashboard] = useState(false);
const [showDailyDeals, setShowDailyDeals] = useState(false);
const [showReferralProgram, setShowReferralProgram] = useState(false);
const [showPriceAlerts, setShowPriceAlerts] = useState(false);
const [showSavedSearches, setShowSavedSearches] = useState(false);
const [showSettings, setShowSettings] = useState(false);
const [showToolsPanel, setShowToolsPanel] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Filters
const [filters, setFilters] = useState({
  minPrice: '',
  maxPrice: '',
  location: '',
  sortBy: 'newest'
});

// Notifications
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

// Profile
const [profileData, setProfileData] = useState(null);
const [isProfileComplete, setIsProfileComplete] = useState(false);
\`\`\`

**Key Functions:**
- \`handleSearch()\` - Triggers search
- \`findProducts()\` - Search for products (buyer)
- \`findProspects()\` - Search for prospects (seller)
- \`handleContact()\` - Open WhatsApp
- \`saveToWishlist()\` - Save item to wishlist
- \`handleSignOut()\` - Logout
- \`handleModeSelect()\` - Switch mode

---

### SellerSetupForm.jsx

Form for sellers to set up their profile and list products.

**Props:**
\`\`\`typescript
interface SellerSetupFormProps {
  onProfileComplete: (data: {
    location: string;
    phone_number: string;
    product_listed: string;
    price: number;
    description: string;
  }) => void;
  existingData?: {
    location?: string;
    phone_number?: string;
  };
  isSellerFlow?: boolean;
  loading?: boolean;
}
\`\`\`

**Features:**
- Product name (required, 3-100 chars)
- Price (required, >0, <999999.99)
- Location (required, 2-100 chars)
- Phone number (required, valid format)
- Description (required, 10-1000 chars)
- Image upload (required)
- Form validation with React Hook Form
- Auto-fill from existing profile

---

### BuyerSetupForm.jsx

Form for buyers to set up their profile and interests.

**Props:**
\`\`\`typescript
interface BuyerSetupFormProps {
  onProfileComplete: (data: {
    location: string;
    phone_number: string;
    interests: string[];
  }) => void;
  existingData?: {
    location?: string;
    phone_number?: string;
    interests?: string[];
  };
  isBuyerFlow?: boolean;
  loading?: boolean;
}
\`\`\`

**Features:**
- Location (required)
- Phone number (required)
- Interests (required, comma-separated)
- Form validation
- Auto-fill from existing profile

---

### SellerDecision.jsx

Decision page for sellers - add products or skip.

**Props:** None

**Features:**
- "Add Products Now" → Opens SellerSetupForm
- "Skip For Now" → Goes to dashboard
- Shows existing profile data status

---

### BuyerDecision.jsx

Decision page for buyers - add interests or skip.

**Props:**
\`\`\`typescript
interface BuyerDecisionProps {
  existingData?: {
    location?: string;
    phone_number?: string;
    interests?: string[];
  };
  onSkip?: () => void;
  onAddInterests?: () => void;
  onSwitchMode?: () => void;
  loading?: boolean;
}
\`\`\`

**Features:**
- "Add Interests Now" → Opens BuyerSetupForm
- "Skip For Now" → Goes to dashboard
- Location/Phone modal if missing

---

### UserDashboard.jsx

Full-screen dashboard with overview, features, and settings.

**Props:**
\`\`\`typescript
interface UserDashboardProps {
  userId: string;
  userName: string;
  userEmail: string;
  selectedMode: 'seller' | 'buyer';
  onClose: () => void;
  pushEnabled: boolean;
  onEnablePush: () => Promise<boolean>;
  pushLoading: boolean;
}
\`\`\`

**Tabs:**
1. **Overview**: Stats, Activity Feed, Insights
2. **Features**: Quick action cards (Saved Searches, Messages, Deals, Alerts, Referrals, Wishlist, Tools)
3. **Settings**: Notification preferences, Account info

---

### WishlistManager.jsx

Displays and manages saved items.

**Features:**
- List saved products and prospects
- Remove items from wishlist
- View details
- Contact saved sellers
- Empty state

---

### NotificationsList.jsx

Displays user notifications.

**Features:**
- List notifications (newest first)
- Mark as read
- Unread count badge
- Click to navigate to related content
- Empty state

---

### RecommendationsSection.jsx

AI-powered product recommendations.

**Props:**
\`\`\`typescript
interface RecommendationsSectionProps {
  userId: string;
  currentProductId?: string;
  onProductClick: (product: Product) => void;
  isSimilar?: boolean;
  isAlternative?: boolean;
  isAlternativeProspects?: boolean;
  searchTerm?: string;
}
\`\`\`

**Features:**
- Similar products
- Alternative suggestions
- Based on user interests
- Based on search history

---

### ChatList.jsx

List of chat conversations.

**Props:**
\`\`\`typescript
interface ChatListProps {
  userId: string;
  onSelectChat: (chat: {
    otherUserId: string;
    otherUser: User;
    product_id: string;
    product: Product;
  }) => void;
  onClose: () => void;
}
\`\`\`

---

### ChatSystem.jsx

In-app chat interface (coming soon).

**Props:**
\`\`\`typescript
interface ChatSystemProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  productId: string;
  productName: string;
  onClose: () => void;
}
\`\`\`

**Currently:** Placeholder with WhatsApp suggestion

---

## Utility Components

### ImageUploader.jsx

Handles image upload with compression.

**Props:**
\`\`\`typescript
interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: Error) => void;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  bucket?: string;
}
\`\`\`

**Features:**
- File selection
- Image compression (browser-image-compression)
- Upload to Supabase Storage
- Progress indicator
- Preview

---

### SafeHTML.jsx

Safely renders HTML content with sanitization.

**Props:**
\`\`\`typescript
interface SafeHTMLProps {
  htmlContent: string;
  className?: string;
  allowLinks?: boolean;
  allowImages?: boolean;
}
\`\`\`

**Uses:** DOMPurify for sanitization

---

### ReportButton.jsx

Floating report button for reporting issues.

**Props:**
\`\`\`typescript
interface ReportButtonProps {
  targetUserId?: string;
  floating?: boolean;
  style?: React.CSSProperties;
}
\`\`\`

---

### TopNavigationBar.jsx

Navigation bar component.

**Features:**
- Logo
- Mode indicator
- Notification bell
- User menu (Settings, Switch Mode, Sign Out)
- Admin crown (for admin users)

---

### UserSettings.jsx

User profile settings.

**Features:**
- Edit profile info
- Change location
- Update phone number
- Manage interests

---

### ToolsPanel.jsx

Advanced tools and features panel.

**Features:**
- Analytics
- Saved searches
- Referral stats
- Daily deals
- Price alerts
- Wishlist

---

## Context Providers

### AuthContext.jsx

\`\`\`javascript
// Usage
const { user, loading, isAuthenticated, selectedMode } = useAuthState();
const { setMode, clearAuthState } = useAuthActions();
\`\`\`

**Provided Values:**
- \`user\`: Current user object
- \`loading\`: Authentication loading state
- \`isAuthenticated\`: Boolean
- \`selectedMode\`: 'seller' | 'buyer' | null
- \`setMode\`: Function to set mode
- \`clearAuthState\`: Function to clear auth

---

### NavigationContext.jsx

\`\`\`javascript
// Usage
const { goBack, getPreviousPage, resetNavigation } = useNavigation();
\`\`\`

**Provided Values:**
- \`navigationStack\`: Array of navigation entries
- \`goBack\`: Go to previous page
- \`getPreviousPage\`: Get previous page data
- \`resetNavigation\`: Clear navigation stack

---

### LoadingContext.jsx

\`\`\`javascript
// Usage
const { withLoading, showLoading, hideLoading } = useLoading();

// Wrap async operations
await withLoading(async () => {
  // Your async code
}, 'Loading message...');
\`\`\`

---

## Custom Hooks

### useBouncer.js

Form validation hook with field registration.

\`\`\`javascript
const bouncer = useBouncer({
  email: '',
  password: '',
  phone: '',
  terms: false
});

const emailRegister = bouncer.register('email');
const passwordRegister = bouncer.register('password');

// In JSX
<input {...emailRegister} />

// Get values on submit
const values = bouncer.getValues();
\`\`\`

---

### useSupabaseQuery.js

React Query wrapper for Supabase.

\`\`\`javascript
const { data, loading, error } = useSupabaseQuery(
  'products',
  (query) => query.select('*').eq('status', 'active'),
  { enabled: !!userId }
);
\`\`\`

---

## Styling

### CSS Files

| File | Purpose |
|------|---------|
| \`App.css\` | Global styles, variables, animations |
| \`Signup.css\` | Authentication page styles |
| \`SellerDecision.css\` | Seller decision page styles |
| \`UserSettings.css\` | Settings page styles |
| \`SafeHTML.css\` | Safe HTML rendering styles |
| \`PushNotificationHandler.css\` | Push notification styles |
| \`CookieBanner.css\` | Cookie consent styles |
| \`index.css\` | Base styles, reset |

### CSS Variables

\`\`\`css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --text-primary: #333;
  --text-secondary: #666;
  --border-color: #ddd;
  --light-bg: #f5f5f5;
  --success-color: #10b981;
  --danger-color: #dc2626;
  --warning-color: #f59e0b;
}
\`\`\`

---

## Component Communication

### Data Flow

\`\`\`
AuthContext → App → SocialAIMarketingEngine
                ↓
          ProtectedRoute
                ↓
          SocialAIMarketingEngine
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Search Section         Results Section
    ↓                       ↓
API Calls         Product/Prospect Cards
    ↓                       ↓
Notifications       User Actions (Contact, Save)
\`\`\`

### Event Flow

1. User searches → \`handleSearch()\`
2. API call → Supabase
3. Results → State update
4. Re-render → Display results
5. User clicks "Contact" → \`handleContact()\`
6. WhatsApp opens → Track activity

---

## Performance Considerations

### Optimizations Used

1. **React.memo**: All major components
2. **useCallback**: Stable function references
3. **useMemo**: Computed values
4. **Lazy Loading**: Route-based code splitting
5. **Debouncing**: Search input (300ms)
6. **Pagination**: Load more products
7. **Caching**: Search results (searchCache)

### Heavy Components

- \`SocialAIMarketingEngine\`: 1000+ lines, should be memoized
- \`RecommendationsSection\`: Makes API calls
- \`ImageUploader\`: Handles file processing

---

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Color contrast compliance
- Screen reader support

---

## Testing Recommendations

### Unit Tests
\`\`\`javascript
// Example test for AuthContext
test('should set user when sign in successful', () => {
  const { result } = renderHook(() => useAuthState(), {
    wrapper: AuthProvider
  });
  expect(result.current.user).toBe(null);
});
\`\`\`

### Integration Tests
\`\`\`javascript
// Example test for search flow
test('should search products and display results', async () => {
  render(<SocialAIMarketingEngine />);
  // Simulate search
  // Check results
});
\`\`\`

### E2E Tests
- Signup flow
- Search flow
- Contact flow
- Wishlist flow
`;

// ============================================================
// 6. DEPLOYMENT.md
// ============================================================
const deploymentContent = `# 🚀 Deployment Guide

## Overview

The Straun Marketing AI Engine can be deployed on various platforms. This guide covers the most common deployment scenarios.

---

## Prerequisites

### Required Accounts
1. **Supabase** (free tier)
2. **Vercel** or **Netlify** (free tier)
3. **GitHub** (for repository)

### Required Tools
- Node.js v18+
- npm or yarn
- Git

---

## Environment Variables

### Required Variables

\`\`\`env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Analytics (Optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# Sentry (Optional)
VITE_SENTRY_DSN=https://your-dsn@ingest.sentry.io/12345

# Push Notifications (Optional)
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
\`\`\`

### How to Get Each Variable

**Supabase:**
1. Go to your Supabase dashboard
2. Click "Settings" → "API"
3. Copy URL and anon key

**Google Analytics:**
1. Create property in Google Analytics
2. Get tracking ID (G-XXXXXXXXXX)

**Sentry:**
1. Create project in Sentry
2. Get DSN from project settings

**VAPID Key:**
1. Generate using \`web-push\` library
2. Save both public and private keys

---

## Deployment Options

### Option 1: Vercel (Recommended)

#### Step 1: Push Code to GitHub

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/social-ai-marketing-app.git
git push -u origin main
\`\`\`

#### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: \`npm run build\`
   - **Output Directory**: \`dist\`
5. Add Environment Variables
6. Click "Deploy"

#### Step 3: Add Environment Variables in Vercel

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add each variable with its value
3. Re-deploy if needed

---

### Option 2: Netlify

#### Step 1: Push Code to GitHub
(Same as above)

#### Step 2: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "Add New Site" → "Import an existing project"
3. Connect GitHub and select repository
4. Configure:
   - **Build Command**: \`npm run build\`
   - **Publish Directory**: \`dist\`
5. Add Environment Variables
6. Click "Deploy Site"

---

### Option 3: Cloudflare Pages

1. Go to Cloudflare Dashboard → Pages
2. Connect to GitHub
3. Select repository
4. Configure:
   - **Build Command**: \`npm run build\`
   - **Build Output**: \`dist\`
   - **Environment Variables**: Add all
5. Deploy

---

### Option 4: Static Hosting (Any Host)

#### Build the App

\`\`\`bash
npm run build
\`\`\`

#### Upload \`dist\` Folder

Upload the entire \`dist\` folder to your hosting provider:
- AWS S3 + CloudFront
- Google Cloud Storage
- Firebase Hosting
- Any static hosting

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your URL and anon key

### 2. Run Database Migrations

In Supabase SQL Editor, run:

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (see DATABASE.md)
-- Create all functions (see DATABASE.md)
-- Create all RLS policies (see DATABASE.md)
-- Create all triggers (see DATABASE.md)
\`\`\`

### 3. Set Up Storage

1. Go to Storage → Create Bucket
2. Name: \`product-images\`
3. Set to public
4. Add RLS policies:

\`\`\`sql
-- Allow public reads
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated uploads
CREATE POLICY "Authenticated Uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );
\`\`\`

### 4. Set Up Authentication

1. Go to Authentication → Providers
2. Enable Email/Password
3. (Optional) Configure email templates
4. Set up redirect URLs in Site URL:
   - Production: \`https://yourapp.com\`
   - Development: \`http://localhost:5173\`

---

## PWA Configuration

### Manifest.json

Update \`public/manifest.json\`:

\`\`\`json
{
  "name": "Straun Marketing AI Engine",
  "short_name": "Straun AI",
  "description": "AI-powered social marketplace",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
\`\`\`

### Service Worker

Update \`public/sw.js\` for your app:

\`\`\`javascript
// Core assets to cache
const CACHE_NAME = 'straun-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Straun-logo.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Push event
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});
\`\`\`

---

## Domain Setup

### Custom Domain (Vercel)

1. Go to your project → Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. Wait for propagation (5-30 minutes)

### Custom Domain (Netlify)

1. Go to Site Settings → Domain Management
2. Add custom domain
3. Configure DNS settings
4. Wait for propagation

---

## SSL/HTTPS

All major platforms automatically provide SSL:
- **Vercel**: Auto SSL (Let's Encrypt)
- **Netlify**: Auto SSL
- **Cloudflare**: Auto SSL
- **Custom Hosting**: Use Let's Encrypt

---

## Monitoring

### Sentry Setup

\`\`\`javascript
// In App.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.PROD ? 'production' : 'development',
  tracesSampleRate: 0.1,
});
\`\`\`

### Google Analytics Setup

\`\`\`javascript
// In App.jsx
import ReactGA from "react-ga4";

ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID);
ReactGA.send({ hitType: "pageview", page: window.location.pathname });
\`\`\`

### Supabase Monitoring

1. Go to Supabase Dashboard
2. Click "Database" → "Metrics"
3. View:
   - Query performance
   - API requests
   - Auth events
   - Storage usage

---

## Performance Monitoring

### Lighthouse

Run Lighthouse in Chrome DevTools:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Click "Generate Report"

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. Add to \`index.html\` or use Vercel's analytics package

### Web Vitals

Monitor Core Web Vitals:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

---

## Post-Deployment Checklist

### ✅ Production Checklist

- [ ] Environment variables set
- [ ] Database migrations run
- [ ] RLS policies enabled
- [ ] Storage bucket created
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] PWA manifest configured
- [ ] Service worker registered
- [ ] Analytics tracking working
- [ ] Error tracking working
- [ ] Push notifications working
- [ ] WhatsApp links working
- [ ] Image upload working
- [ ] Search functionality working
- [ ] Authentication working
- [ ] Notifications working
- [ ] Payment gateway (if applicable)

### ✅ Performance Checklist

- [ ] Lighthouse score > 90
- [ ] Page load < 3 seconds
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.8s
- [ ] All images optimized
- [ ] Code splitting enabled
- [ ] Caching headers set
- [ ] Gzip compression enabled

---

## Troubleshooting

### Common Issues

#### "Failed to fetch products"

**Solution:**
1. Check Supabase URL and key
2. Verify RLS policies
3. Check network tab for errors
4. Ensure user is authenticated

#### "Image upload failed"

**Solution:**
1. Check storage bucket exists
2. Verify RLS policies for storage
3. Check file size limits
4. Verify content-type is correct

#### "Push notifications not working"

**Solution:**
1. Check VAPID keys
2. Verify service worker registration
3. Check browser permissions
4. Check Edge Function logs

#### "WhatsApp contact not working"

**Solution:**
1. Check phone number format
2. Verify country code
3. Test with different browsers
4. Check console for errors

#### "Authentication failing"

**Solution:**
1. Check Supabase URL
2. Verify anon key
3. Check email/password
4. Check redirect URL configuration

---

## Rollback

### Vercel Rollback

1. Go to Vercel dashboard
2. Select deployment
3. Click "Promote" (for previous deployment)

### Netlify Rollback

1. Go to Netlify dashboard
2. Click "Deploys"
3. Click "Publish" on previous deployment

### Git Rollback

\`\`\`bash
git revert HEAD
git push
# Or
git reset --hard <commit-hash>
git push --force
\`\`\`

---

## Backup Strategy

### Database Backup

Supabase automatically backs up:
- Daily backups available
- Point-in-time recovery (Pro plans)

### Manual Backup

\`\`\`bash
# Export database
pg_dump -h your-db-host -U your-user -d your-db > backup.sql

# Import database
psql -h your-db-host -U your-user -d your-db < backup.sql
\`\`\`

### File Backup

Back up storage bucket files:
- Use Supabase CLI
- Download manually
- Use third-party backup service

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] RLS policies configured
- [ ] Input sanitization (DOMPurify)
- [ ] CORS configuration
- [ ] Environment variables secure
- [ ] Rate limiting enabled
- [ ] CSRF protection
- [ ] Session timeout set
- [ ] Email verification enabled
- [ ] Password requirements enforced
`;

// ============================================================
// 7. CONTRIBUTING.md
// ============================================================
const contributingContent = `# 🤝 Contributing Guide

## Welcome!

Thank you for considering contributing to the Straun Marketing AI Engine. This guide will help you get started.

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of:
- Age
- Body size
- Disability
- Ethnicity
- Gender identity and expression
- Level of experience
- Nationality
- Personal appearance
- Race
- Religion
- Sexual identity and orientation

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards other community members

**Unacceptable behavior:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## How to Contribute

### 1. Reporting Bugs

Before reporting a bug:
1. Check existing issues
2. Check if it's already fixed in development
3. Check that it's actually a bug (not user error)

When reporting:
- **Title**: Clear and descriptive
- **Description**: Step-by-step reproduction
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: Browser, OS, version

### 2. Suggesting Features

- **Title**: Clear and descriptive
- **Description**: What, why, and how
- **Examples**: Show usage examples
- **Alternatives**: Any other solutions considered

### 3. Pull Requests

1. Fork the repository
2. Create your feature branch:
   \`\`\`bash
   git checkout -b feature/AmazingFeature
   \`\`\`
3. Make your changes
4. Test your changes
5. Commit your changes:
   \`\`\`bash
   git commit -m 'Add some AmazingFeature'
   \`\`\`
6. Push to the branch:
   \`\`\`bash
   git push origin feature/AmazingFeature
   \`\`\`
7. Open a Pull Request

### Pull Request Guidelines

- **One feature per PR**: Keep it focused
- **Write tests**: For new features
- **Update docs**: For new features
- **Follow coding style**: Use ESLint
- **Keep it clean**: No unrelated changes

---

## Development Setup

### Prerequisites

\`\`\`bash
# Node.js v18+
node --version

# npm or yarn
npm --version

# Git
git --version
\`\`\`

### Clone and Install

\`\`\`bash
# Clone your fork
git clone https://github.com/yourusername/social-ai-marketing-app.git
cd social-ai-marketing-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
\`\`\`

---

## Coding Standards

### JavaScript/React

**Use functional components:**
\`\`\`jsx
// ✅ Good
const MyComponent = ({ prop }) => {
  return <div>{prop}</div>;
};

// ❌ Bad
class MyComponent extends React.Component {
  render() {
    return <div>{this.props.prop}</div>;
  }
}
\`\`\`

**Use hooks:**
\`\`\`jsx
// ✅ Good
const MyComponent = () => {
  const [state, setState] = useState(null);
  useEffect(() => {
    // ...
  }, []);
  return <div />;
};
\`\`\`

**Name exports:**
\`\`\`jsx
// ✅ Good
export default MyComponent;
export const helperFunction = () => {};

// ❌ Bad
export default () => {};
\`\`\`

### CSS

**Use CSS variables:**
\`\`\`css
/* ✅ Good */
.button {
  background: var(--primary-color);
  color: var(--text-primary);
}

/* ❌ Bad */
.button {
  background: #667eea;
  color: #333;
}
\`\`\`

**Use class names, not inline styles:**
\`\`\`jsx
// ✅ Good
<div className="container" />

// ❌ Bad
<div style={{ padding: '20px' }} />
\`\`\`

---

## Testing

### Running Tests

\`\`\`bash
# Run all tests
npm test

# Run specific test
npm test -- --testPathPattern=AuthContext

# Run with coverage
npm test -- --coverage
\`\`\`

### Writing Tests

\`\`\`javascript
// Example test
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component with prop', () => {
  render(<MyComponent prop="test" />);
  expect(screen.getByText('test')).toBeInTheDocument();
});
\`\`\`

---

## Git Workflow

### Branch Naming

- \`feature/*\` - New features
- \`bugfix/*\` - Bug fixes
- \`hotfix/*\` - Urgent fixes
- \`docs/*\` - Documentation updates
- \`chore/*\` - Maintenance

### Commit Messages

Format: \`<type>(<scope>): <subject>\`

**Types:**
- \`feat\`: New feature
- \`fix\`: Bug fix
- \`docs\`: Documentation
- \`style\`: Formatting
- \`refactor\`: Code restructuring
- \`perf\`: Performance
- \`test\`: Testing
- \`chore\`: Maintenance

**Examples:**
\`\`\`
feat(auth): add Google OAuth login
fix(search): fix product search filter
docs(readme): update installation guide
perf(images): optimize image loading
\`\`\`

### Branch Protection Rules

1. PR required for main branch
2. At least 1 review required
3. All checks must pass
4. No direct pushes to main

---

## Code Review Process

### Reviewer Guidelines

1. **Understand the change**: Read the description
2. **Check the code**: Look for issues
3. **Test it**: Run it locally
4. **Be constructive**: Focus on the code, not the person
5. **Be timely**: Review within 2 days

### What to Look For

- ✅ Code style consistency
- ✅ Test coverage
- ✅ Performance implications
- ✅ Security concerns
- ✅ Documentation updates
- ✅ Error handling
- ✅ Edge cases

### Review Comments

- \`[suggestion]\`: Optional improvement
- \`[question]\`: Clarification needed
- \`[blocking]\`: Must be fixed

---

## Documentation

### Where to Update

- **README.md**: Project overview
- **ARCHITECTURE.md**: System design
- **API.md**: API documentation
- **COMPONENTS.md**: Component docs
- **DATABASE.md**: Schema docs
- **DEPLOYMENT.md**: Deployment guide

### JSDoc Comments

\`\`\`javascript
/**
 * Fetches products based on search term
 * @param {string} searchTerm - The term to search for
 * @param {Object} filters - Search filters
 * @param {number} filters.minPrice - Minimum price
 * @param {number} filters.maxPrice - Maximum price
 * @returns {Promise<Array>} List of products
 */
const fetchProducts = async (searchTerm, filters) => {
  // ...
};
\`\`\`

---

## Performance Guidelines

### Optimization Principles

1. **Measure first**: Don't optimize prematurely
2. **Minimize re-renders**: Use memoization
3. **Lazy load**: Split code
4. **Cache**: Use React Query, localStorage
5. **Debounce**: Search, input events

### Performance Budget

- **Load time**: < 3 seconds
- **First paint**: < 1.8 seconds
- **Time to interactive**: < 3.8 seconds
- **Lighthouse score**: > 90
- **Bundle size**: < 500KB (gzipped)

---

## Security Guidelines

### Never

- ❌ Store secrets in code
- ❌ Disable CORS without need
- ❌ Trust user input without sanitization
- ❌ Log sensitive information
- ❌ Use eval() or new Function()

### Always

- ✅ Use DOMPurify for HTML
- ✅ Sanitize all user inputs
- ✅ Validate on server (RLS)
- ✅ Use HTTPS
- ✅ Keep dependencies updated

---

## Accessibility Guidelines

### Must Do

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Sufficient color contrast
- ✅ Screen reader support

### Test With

- VoiceOver (Mac)
- NVDA (Windows)
- ChromeVox (Chrome)
- Keyboard only
- Color blindness simulators

---

## Questions?

### Resources

- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [ESLint Documentation](https://eslint.org)
- [Prettier Documentation](https://prettier.io)

### Contact

- Email: deonmahachi8@gmail.com
- Issues: GitHub Issues
- Discussions: GitHub Discussions

---

## Thank You!

Your contributions make this project better. 🙏
`;

// ============================================================
// 8. CHANGELOG.md
// ============================================================
const changelogContent = `# 📝 Changelog

All notable changes to the Straun Marketing AI Engine will be documented in this file.

---

## [1.0.0] - 2025-01-01

### 🎉 Initial Release

### Added

#### Authentication
- Email/password signup with optional phone number
- Email/password signin
- Password reset functionality
- Session persistence with Supabase
- Auto-login on refresh

#### User Modes
- **Seller Mode**: List products, find prospects
- **Buyer Mode**: Search products, set interests

#### Core Features
- Product listing with image upload (ImageUploader)
- Product search with filters (price, location, sort)
- Product categories and tags
- Seller profile management
- Buyer interests management

#### Matching System
- AI-powered interest matching
- Real-time notifications for matches
- Seller gets notified when buyer searches their product
- Buyer gets notified when matching product is listed

#### Communication
- WhatsApp integration (one-click contact)
- Phone call (tel: links)
- SMS (sms: links)
- In-app chat (placeholder)

#### Wishlist
- Save products and prospects
- Follow-up reminders (2 days)
- Wishlist Manager with CRUD operations

#### Notifications
- Real-time notifications via Supabase subscriptions
- Push notifications (web)
- Toast notifications in-app
- Notification center with read/unread status

#### Recommendations
- Product recommendations based on user interests
- Similar products
- Alternative suggestions when no results found

#### Referral Program
- Generate referral links
- Earn points for referrals
- Track referral completions

#### Daily Deals
- Curated deals of the day
- Limited-time offers
- Exclusive for members

#### Price Alerts
- Set target prices
- Get notified when price drops
- Manage active alerts

#### Admin Dashboard
- View app analytics
- Error monitoring
- User management (simple)

#### PWA Support
- Service worker for offline support
- Push notifications
- Home screen installation
- Full-screen experience

#### Performance
- Lazy loading with React.lazy + Suspense
- React.memo for pure components
- Debounced search (300ms)
- Search caching
- Pagination (load more)
- Image compression (browser-image-compression)

#### Security
- JWT authentication
- Row Level Security (RLS)
- Input sanitization (DOMPurify)
- Rate limiting (SmartRateLimiter)
- Error boundaries
- Sentry integration

#### Analytics
- Google Analytics 4 integration
- User behavior monitoring
- Activity tracking
- Error tracking (Sentry)

### 🐛 Bug Fixes
- Fixed auth session persistence
- Fixed real-time notification reconnection
- Fixed image upload error handling
- Fixed phone number validation
- Fixed search cache invalidation
- Fixed mobile menu rendering

### 📚 Documentation
- Added README.md
- Added Architecture documentation
- Added API documentation
- Added Database schema documentation
- Added Component documentation
- Added Deployment guide
- Added Contributing guide
- Added Changelog

---

## [Unreleased]

### ✨ Planned Features

#### Chat System
- Real-time in-app messaging
- Read receipts
- Typing indicators
- Image sharing
- Voice notes
- Quick replies

#### Advanced AI
- ML-based product recommendations
- Personalized search results
- Smart notifications prioritization
- User behavior prediction

#### Payment Integration
- Stripe integration
- PayPal integration
- In-app payments
- Escrow service
- Transaction history

#### Rating System
- User reviews and ratings
- Seller rating
- Product reviews
- Review verification

#### Mobile Apps
- React Native iOS app
- React Native Android app
- Push notifications for mobile
- Mobile-specific features

#### Analytics Dashboard
- Advanced seller analytics
- Sales reports
- Conversion tracking
- User engagement metrics
- A/B testing support

#### Multi-language
- i18n support
- Language selector
- Translated UI
- Translated content

#### Social Features
- Social media sharing
- Product share to status
- Referral sharing
- Community features

#### Enhanced Security
- 2FA authentication
- OAuth providers (Google, Facebook)
- Social login
- Advanced rate limiting
- IP-based blocking

#### Performance
- Edge Functions optimization
- CDN integration
- Image optimization pipeline
- Advanced caching strategies
- Server-side rendering (SSR)

#### Accessibility
- WCAG 2.1 compliance
- Screen reader optimization
- Keyboard navigation improvements
- High contrast mode

### 🐛 Known Issues
- Push notifications intermittent on some browsers
- Image upload slow on poor connections
- Search results not always accurate
- Chat system not implemented yet
- Mobile performance on older devices

---

## Version History

### v1.0.0 - Initial Release
- Complete core functionality
- All features documented above

### v0.9.0 - Beta
- Internal testing
- Bug fixes
- Performance improvements

### v0.8.0 - Alpha
- Feature development
- Initial testing

---

## How to Update

### Update Dependencies

\`\`\`bash
# Check outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages (careful!)
npm update
\`\`\`

### Migration Guide

#### From v0.9.0 to v1.0.0

1. **Backup database**
   \`\`\`bash
   pg_dump -h host -U user -d database > backup.sql
   \`\`\`

2. **Run migrations**
   \`\`\`sql
   -- Add any new columns
   ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
   \`\`\`

3. **Update environment variables**
   \`\`\`env
   # Add new variables
   VITE_VAPID_PUBLIC_KEY=your-key
   \`\`\`

4. **Rebuild and deploy**
   \`\`\`bash
   npm install
   npm run build
   npm run deploy
   \`\`\`

---

## Release Process

### 1. Create Release Branch

\`\`\`bash
git checkout -b release/v1.0.0
\`\`\`

### 2. Update Version

Update \`package.json\`:
\`\`\`json
{
  "version": "1.0.0"
}
\`\`\`

### 3. Update Changelog

Add new version section above

### 4. Commit Changes

\`\`\`bash
git add .
git commit -m "chore: release v1.0.0"
\`\`\`

### 5. Create Tag

\`\`\`bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
\`\`\`

### 6. Deploy

Deploy to production

### 7. Verify

- Check all features work
- Check monitoring
- Check analytics

---

## Contributors

- Deon Mahachi - Initial work

---

## License

This project is proprietary and confidential.

---

**End of Changelog**
`;

// ============================================================
// WRITE ALL FILES
// ============================================================

const files = [
  { name: 'README.md', content: readmeContent },
  { name: 'ARCHITECTURE.md', content: architectureContent },
  { name: 'API.md', content: apiContent },
  { name: 'DATABASE.md', content: databaseContent },
  { name: 'COMPONENTS.md', content: componentsContent },
  { name: 'DEPLOYMENT.md', content: deploymentContent },
  { name: 'CONTRIBUTING.md', content: contributingContent },
  { name: 'CHANGELOG.md', content: changelogContent }
];

files.forEach(({ name, content }) => {
  const filePath = path.join(docsDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Created: docs/${name}`);
});

console.log('\n🎉 Documentation generation complete!');
console.log(`📁 Check the "docs" folder: ${docsDir}`);
console.log('\n📋 Files created:');
files.forEach(({ name }) => console.log(`  - ${name}`));
console.log('\n📚 You can now commit and push these files.');