# 🧩 Component Documentation

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
```jsx
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
```

---

### signup.jsx (Auth Page)

The authentication page with signup and signin.

**Props:** None

**State:**
- `loading`: Boolean for submission status
- `isSignUp`: Boolean toggle signup/signin
- `message`: { text, type } for feedback

**Features:**
- Email/password signup
- Optional phone number
- Terms & Privacy agreement
- Password visibility toggle
- Form validation
- Referral code support
- Auto-login after signup

**Key Functions:**
- `handleSignUp()` - Creates new account
- `handleSignIn()` - Logs in user
- `handleForgotPassword()` - Sends reset email

---

### SocialAIMarketingEngine.jsx

The main application dashboard. **This is the largest component.**

**Props:** None

**State Management:**
```javascript
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
```

**Key Functions:**
- `handleSearch()` - Triggers search
- `findProducts()` - Search for products (buyer)
- `findProspects()` - Search for prospects (seller)
- `handleContact()` - Open WhatsApp
- `saveToWishlist()` - Save item to wishlist
- `handleSignOut()` - Logout
- `handleModeSelect()` - Switch mode

---

### SellerSetupForm.jsx

Form for sellers to set up their profile and list products.

**Props:**
```typescript
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
```

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
```typescript
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
```

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
```typescript
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
```

**Features:**
- "Add Interests Now" → Opens BuyerSetupForm
- "Skip For Now" → Goes to dashboard
- Location/Phone modal if missing

---

### UserDashboard.jsx

Full-screen dashboard with overview, features, and settings.

**Props:**
```typescript
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
```

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

# ❤️ Wishlist System Documentation

## Overview
Users can save products, prospects, AND notifications to their wishlist.

## Item Types

| Type | Description | Source |
|------|-------------|--------|
| product | Product listing | Products table |
| prospect | Potential customer | Profiles table |
| notification | Notification with contact info | Notifications table |

## Saving Items

### Save Product
\`\`\`javascript
await supabase.from('saved_items').insert({
  user_id: userId,
  product_id: productId,
  item_type: 'product',
  product_name: product.name,
  product_price: product.price,
  // ...
});
\`\`\`

### Save Prospect
\`\`\`javascript
await supabase.from('saved_items').insert({
  user_id: userId,
  prospect_id: prospectId,
  item_type: 'prospect',
  prospect_email: prospect.email,
  // ...
});
\`\`\`

### Save Notification
\`\`\`javascript
await supabase.from('saved_items').insert({
  user_id: userId,
  notification_id: notificationId,
  item_type: 'notification',
  product_name: product?.name,
  product_price: product?.price,
  seller_phone: sender?.phone_number,
  // ...
});
\`\`\`

## Viewing Saved Items

### WishlistManager Component
\`\`\`jsx
<WishlistManager 
  userId={user.id}
  onBack={() => setShowWishlist(false)}
/>
\`\`\`

### Filter by Type
\`\`\`javascript
// Show only products
const products = savedItems.filter(item => item.item_type === 'product');

// Show only notifications
const notifications = savedItems.filter(item => item.item_type === 'notification');
\`\`\`

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
```typescript
interface RecommendationsSectionProps {
  userId: string;
  currentProductId?: string;
  onProductClick: (product: Product) => void;
  isSimilar?: boolean;
  isAlternative?: boolean;
  isAlternativeProspects?: boolean;
  searchTerm?: string;
}
```

**Features:**
- Similar products
- Alternative suggestions
- Based on user interests
- Based on search history

---

### ChatList.jsx

List of chat conversations.

**Props:**
```typescript
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
```

---

### ChatSystem.jsx

In-app chat interface (coming soon).

**Props:**
```typescript
interface ChatSystemProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  productId: string;
  productName: string;
  onClose: () => void;
}
```

**Currently:** Placeholder with WhatsApp suggestion

---

## Utility Components

### ImageUploader.jsx

Handles image upload with compression.

**Props:**
```typescript
interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: Error) => void;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  bucket?: string;
}
```

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
```typescript
interface SafeHTMLProps {
  htmlContent: string;
  className?: string;
  allowLinks?: boolean;
  allowImages?: boolean;
}
```

**Uses:** DOMPurify for sanitization

---

### ReportButton.jsx

Floating report button for reporting issues.

**Props:**
```typescript
interface ReportButtonProps {
  targetUserId?: string;
  floating?: boolean;
  style?: React.CSSProperties;
}
```

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

```javascript
// Usage
const { user, loading, isAuthenticated, selectedMode } = useAuthState();
const { setMode, clearAuthState } = useAuthActions();
```

**Provided Values:**
- `user`: Current user object
- `loading`: Authentication loading state
- `isAuthenticated`: Boolean
- `selectedMode`: 'seller' | 'buyer' | null
- `setMode`: Function to set mode
- `clearAuthState`: Function to clear auth

---

### NavigationContext.jsx

```javascript
// Usage
const { goBack, getPreviousPage, resetNavigation } = useNavigation();
```

**Provided Values:**
- `navigationStack`: Array of navigation entries
- `goBack`: Go to previous page
- `getPreviousPage`: Get previous page data
- `resetNavigation`: Clear navigation stack

---

### LoadingContext.jsx

```javascript
// Usage
const { withLoading, showLoading, hideLoading } = useLoading();

// Wrap async operations
await withLoading(async () => {
  // Your async code
}, 'Loading message...');
```

---

## Custom Hooks

### useBouncer.js

Form validation hook with field registration.

```javascript
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
```

---

### useSupabaseQuery.js

React Query wrapper for Supabase.

```javascript
const { data, loading, error } = useSupabaseQuery(
  'products',
  (query) => query.select('*').eq('status', 'active'),
  { enabled: !!userId }
);
```

---

## Styling

### CSS Files

| File | Purpose |
|------|---------|
| `App.css` | Global styles, variables, animations |
| `Signup.css` | Authentication page styles |
| `SellerDecision.css` | Seller decision page styles |
| `UserSettings.css` | Settings page styles |
| `SafeHTML.css` | Safe HTML rendering styles |
| `PushNotificationHandler.css` | Push notification styles |
| `CookieBanner.css` | Cookie consent styles |
| `index.css` | Base styles, reset |

### CSS Variables

```css
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
```

---

## Component Communication

### Data Flow

```
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
```

### Event Flow

1. User searches → `handleSearch()`
2. API call → Supabase
3. Results → State update
4. Re-render → Display results
5. User clicks "Contact" → `handleContact()`
6. WhatsApp opens → Track activity

---

# 📞 Phone Number Flow Documentation

## Overview
How phone numbers flow through the system for buyer-seller communication.

## Flow Diagram
┌─────────────────────────────────────────────────────────────┐
│ USER SIGNS UP │
│ - Phone number collected (optional during signup) │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ USER COMPLETES SETUP │
│ - Seller: phone_number stored in profiles │
│ - Buyer: phone_number stored in profiles │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ USER ACTIONS │
│ │
│ BUYER SEARCHES: │
│ → Get buyer phone from profiles │
│ → Save in notification (buyer_phone field) │
│ │
│ SELLER LISTS PRODUCT: │
│ → Get seller phone from profiles │
│ → Save in product (phone_number field) │
│ │
│ USER CONTACTS: │
│ → Get sender phone from profiles │
│ → Save in notification (buyer_phone field) │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ NOTIFICATION DETAIL PAGE │
│ - Display buyer_phone with icons │
│ - Contact buttons: Call, SMS, WhatsApp │
└─────────────────────────────────────────────────────────────┘

text

## Database Fields

| Table | Field | Purpose |
|-------|-------|---------|
| profiles | phone_number | User's primary phone |
| products | phone_number | Seller's contact phone |
| notifications | buyer_phone | Phone of the person contacting |

## Code Examples

### Getting Buyer Phone During Search
\`\`\`javascript
// In SocialAIMarketingEngine.jsx - handleContact
const { data: { user: currentUser } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('phone_number')
  .eq('id', currentUser?.id)
  .single();

await supabase.from('notifications').insert([{
  user_id: targetUserId,
  sender_id: currentUser?.id,
  buyer_phone: profile?.phone_number || 'No phone provided',
  // ...
}]);
\`\`\`

### Displaying in Notification Detail
\`\`\`jsx
// In NotificationDetail.jsx
const phoneNumber = notification?.buyer_phone || 
                     product?.phone_number || 
                     sender?.phone_number;

{phoneNumber && (
  <div className="contact-section">
    <div className="phone-display">
      <FontAwesomeIcon icon={faPhone} />
      <span>{phoneNumber}</span>
    </div>
    <div className="contact-buttons">
      <button onClick={() => window.open(\`tel:\${phoneNumber}\`)}>
        📞 Call
      </button>
      <button onClick={() => window.open(\`sms:\${phoneNumber}\`)}>
        ✉️ SMS
      </button>
      <button onClick={() => window.open(\`https://wa.me/\${phoneNumber}\`)}>
        💬 WhatsApp
      </button>
    </div>
  </div>
)}
\`\`\`


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

- `SocialAIMarketingEngine`: 1000+ lines, should be memoized
- `RecommendationsSection`: Makes API calls
- `ImageUploader`: Handles file processing

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
```javascript
// Example test for AuthContext
test('should set user when sign in successful', () => {
  const { result } = renderHook(() => useAuthState(), {
    wrapper: AuthProvider
  });
  expect(result.current.user).toBe(null);
});
```

### Integration Tests
```javascript
// Example test for search flow
test('should search products and display results', async () => {
  render(<SocialAIMarketingEngine />);
  // Simulate search
  // Check results
});
```

### E2E Tests
- Signup flow
- Search flow
- Contact flow
- Wishlist flow
