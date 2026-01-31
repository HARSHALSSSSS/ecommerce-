# Ecommerce Mobile App - React Native with Expo

A fully functional ecommerce mobile app built with React Native and Expo, matching the Figma design perfectly with complete backend functionality using SQLite.

## 📱 Features

✅ **Home Screen**
- Greeting with user name
- Delivery location selector
- Category icons navigation
- Popular products grid with discounts
- Collections section

✅ **Product Detail Screen**
- Multiple product images
- Star ratings
- Discount badges
- Size selection (S-XXXL)
- Quantity control
- Buy Now & Add to Cart buttons

✅ **Store Screen**
- Store information (name, location)
- Ratings, followers, order processing time
- Product & Testimoni tabs
- Product grid with filters
- Customer testimonials

✅ **Cart Management**
- View all cart items
- Remove items
- Calculate totals
- Checkout functionality

✅ **User Profile**
- View/Edit personal information
- Account settings
- Order history
- Logout

✅ **Database Features**
- SQLite local storage
- Product management
- User authentication
- Order tracking
- Cart persistence

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **Database**: SQLite (expo-sqlite)
- **Navigation**: Expo Router (File-based routing)
- **UI Components**: React Native & @expo/vector-icons
- **State Management**: React Hooks
- **Styling**: StyleSheet (React Native)

## 📋 Project Structure

```
ecommerce-app/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Home Screen
│   │   ├── explore.tsx        # Store Screen
│   │   ├── cart.tsx           # Cart Screen
│   │   ├── profile.tsx        # Profile Screen
│   │   └── _layout.tsx        # Tab Navigation
│   ├── product-detail.tsx     # Product Detail Screen
│   └── _layout.tsx            # Root Layout
├── src/
│   ├── database/
│   │   └── db.ts              # SQLite Database Setup
│   ├── constants/
│   │   └── colors.ts          # Color & Spacing Constants
│   ├── screens/               # (Legacy screen components)
│   ├── components/            # Reusable Components
│   └── services/              # API Services
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript Config
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo Go app (for testing on mobile)

### Installation

1. **Navigate to project directory**
   ```bash
   cd "c:\Users\Lenovo\Desktop\agumentix 1\ecommerce-app"
   ```

2. **Install dependencies** (already done, but if needed):
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on Android Emulator**
   ```bash
   npm run android
   ```
   Or press `a` in the terminal

5. **Run on iOS** (macOS only)
   ```bash
   npm run ios
   ```

6. **Run on Web**
   ```bash
   npm run web
   ```
   Or press `w` in the terminal

## 📦 Available Commands

```bash
npm start           # Start Expo development server
npm run android     # Build and run on Android
npm run ios         # Build and run on iOS
npm run web         # Run on web browser
npm run build       # Build for production
npm run export      # Export production-ready bundle
```

## 🎨 Design System

### Colors
- **Primary**: #E07856 (Orange)
- **Dark**: #1A1A1A (Black)
- **White**: #FFFFFF
- **Gray**: #F5F5F5
- **Light Gray**: #ECECEC

### Spacing
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- xxl: 32px

## 💾 Database Schema

### Tables

**users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**products**
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  category TEXT,
  rating REAL DEFAULT 0,
  image_url TEXT,
  store_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**stores**
```sql
CREATE TABLE stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  rating REAL DEFAULT 0,
  followers INTEGER DEFAULT 0,
  order_processed TEXT DEFAULT '2 Hours',
  image_url TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**cart**
```sql
CREATE TABLE cart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER,
  quantity INTEGER DEFAULT 1,
  size TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**orders**
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**order_items**
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  size TEXT,
  price REAL NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
```

## 🔄 Key Features Implementation

### Home Screen Flow
1. User sees greeting with name
2. Can select delivery location
3. Browse products by category
4. Tap product to view details
5. Add to cart or buy immediately

### Product Detail Flow
1. View product images
2. Check ratings & reviews
3. Select size and quantity
4. Add to cart or checkout
5. Confirm order

### Cart & Checkout
1. View all items in cart
2. Adjust quantities
3. Remove items
4. Calculate total
5. Proceed to checkout
6. Confirm order

### User Profile
1. View personal information
2. Edit profile details
3. View order history
4. Account settings
5. Logout

## 🔐 Security Considerations

- Store sensitive data securely
- Validate all user inputs
- Use encrypted storage for passwords
- Implement proper authentication
- Add API key management for backend

## 📚 Next Steps for Production

1. **Backend Setup**
   - Create Node.js/Express API server
   - Implement authentication (JWT)
   - Set up cloud database (MongoDB/PostgreSQL)
   - Implement payment gateway integration

2. **Image Management**
   - Upload product images to cloud storage (AWS S3)
   - Implement image caching

3. **Push Notifications**
   - Add Expo Notifications API
   - Send order updates & promotions

4. **Testing**
   - Unit tests with Jest
   - Integration tests
   - E2E testing

5. **Deployment**
   - Build APK/AAB for Android
   - Build IPA for iOS
   - Deploy to app stores

## 📱 Running the App

The development server is already running at:
- **Expo**: exp://192.168.0.106:8081
- **Web**: http://localhost:8081

To run on your device:
1. Install Expo Go app
2. Scan the QR code shown in terminal
3. App will open on your device

## 🐛 Troubleshooting

**"Metro Bundler Error"**
- Clear cache: `npm start -- --reset-cache`

**"Database Error"**
- The database is automatically initialized on first run
- Check `/src/database/db.ts` for schema

**"Module not found"**
- Ensure all dependencies are installed: `npm install`

**"Port already in use"**
- Kill process on port 8081 and restart

## 📧 Support & Contact

For issues or questions about the app, please check the project documentation or contact the development team.

---

**Built with ❤️ using React Native & Expo**
