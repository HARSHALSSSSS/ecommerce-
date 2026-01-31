# E-commerce Backend API

A Node.js + Express + TypeScript backend API for the e-commerce platform. This API serves both the admin dashboard and the mobile app.

## Features

- 🔐 **Authentication**: JWT-based authentication for admins and users
- 🛡️ **Security**: Helmet, CORS, Rate limiting, hCaptcha verification
- 📦 **Products**: Full CRUD operations with categories and search
- 🛒 **Cart**: Shopping cart management
- 📋 **Orders**: Order management with status tracking
- 👥 **Users**: User management for admins
- 🏪 **Stores**: Multi-store support
- 📊 **Dashboard**: Analytics and statistics API
- 📧 **Email**: Password reset with email support

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
cd ecommerce-backend
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Or use the pre-configured `.env` file and update the values as needed.

**Important Environment Variables:**

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `JWT_SECRET` | Secret key for JWT tokens (change in production!) |
| `HCAPTCHA_SECRET_KEY` | hCaptcha secret key for verification |
| `SMTP_*` | Email configuration for password reset |
| `ADMIN_EMAIL` | Default admin email |
| `ADMIN_PASSWORD` | Default admin password |

### 3. Seed the Database

Run the seed script to create the default admin and sample data:

```bash
npm run seed
```

This will:
- Create the SQLite database
- Create a default admin account
- Add sample products and stores

### 4. Start the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

The server will start at `http://localhost:5000`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/admin/forgot-password` | Request password reset |
| POST | `/api/auth/admin/reset-password` | Reset password |
| GET | `/api/auth/admin/verify-token` | Verify admin token |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product (Admin) |
| PUT | `/api/products/:id` | Update product (Admin) |
| DELETE | `/api/products/:id` | Delete product (Admin) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | Get all orders (Admin) |
| GET | `/api/orders/:id` | Get single order |
| POST | `/api/orders` | Create order (User) |
| PATCH | `/api/orders/:id/status` | Update order status (Admin) |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (Admin) |
| GET | `/api/users/:id` | Get single user (Admin) |
| PUT | `/api/users/:id` | Update user (Admin) |
| PATCH | `/api/users/:id/toggle-active` | Toggle user status (Admin) |

### Stores
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | Get all stores |
| GET | `/api/stores/:id` | Get single store |
| POST | `/api/stores` | Create store (Admin) |
| PUT | `/api/stores/:id` | Update store (Admin) |
| DELETE | `/api/stores/:id` | Delete store (Admin) |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart (User) |
| POST | `/api/cart/add` | Add to cart (User) |
| PUT | `/api/cart/:id` | Update cart item (User) |
| DELETE | `/api/cart/:id` | Remove from cart (User) |
| DELETE | `/api/cart` | Clear cart (User) |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/recent-orders` | Get recent orders |
| GET | `/api/dashboard/sales-chart` | Get sales chart data |
| GET | `/api/dashboard/top-products` | Get top selling products |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

## Default Admin Credentials

After running `npm run seed`:

- **Email**: admin@ecommerce.com
- **Password**: Admin@123456

⚠️ **Change these credentials in production!**

## Database

This project uses SQLite for simplicity. The database file is created at `./database.sqlite`.

### Tables
- `admins` - Admin accounts
- `users` - Customer accounts
- `products` - Product catalog
- `stores` - Store locations
- `cart` - Shopping carts
- `orders` - Customer orders
- `order_items` - Order line items
- `password_resets` - Password reset tokens
- `admin_logs` - Admin activity logs

## Security Features

1. **Helmet**: Secure HTTP headers
2. **CORS**: Cross-origin resource sharing
3. **Rate Limiting**: 100 requests/15min general, 5/15min for auth
4. **hCaptcha**: Bot protection on login
5. **JWT**: Secure token-based authentication
6. **bcrypt**: Password hashing

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run seed` | Seed database with admin and sample data |

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4.18
- **Language**: TypeScript 5.3
- **Database**: SQLite 3
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Email**: Nodemailer
- **Security**: Helmet, express-rate-limit
