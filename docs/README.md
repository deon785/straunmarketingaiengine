# 🚀 Straun Marketing AI Engine

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
```bash
git clone https://github.com/yourusername/social-ai-marketing-app.git
cd social-ai-marketing-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GA_TRACKING_ID=your_ga_tracking_id
VITE_SENTRY_DSN=your_sentry_dsn
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

4. **Run development server**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
npm run preview
```

## 🗄️ Database Schema

### Core Tables

```sql
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
```

## 🏗️ Project Structure

```
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
```

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
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `VITE_GA_TRACKING_ID` | Google Analytics ID | ❌ |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking | ❌ |
| `VITE_VAPID_PUBLIC_KEY` | VAPID key for push notifications | ❌ |

## 📱 PWA Support

The app is a **Progressive Web App** with:
- Offline support via Service Worker
- Push notifications
- Home screen installation
- Full-screen experience

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 🙏 Support

For support, email deonmahachi8@gmail.com or open an issue.

---

**Built with ❤️ using React + Supabase**
