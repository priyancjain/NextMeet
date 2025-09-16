# NextMeet

# Next.js Scheduler - Google Calendar Integration

A comprehensive scheduling application built with Next.js that enables seamless appointment booking between sellers and buyers with Google Calendar integration.

## 🚀 Features

- **Seller Dashboard**: Connect Google Calendar, view booking statistics, manage availability
- **Buyer Booking**: Browse available sellers, view time slots, book appointments
- **Google Calendar Integration**: Automatic event creation on both calendars with Google Meet links
- **Secure Authentication**: Google OAuth2 with encrypted refresh token storage
- **Appointments Management**: View upcoming and past appointments for both roles
- **Real-time Availability**: 14-day availability window with 30-minute slots during business hours

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Authentication**: NextAuth.js with Google OAuth2
- **Database**: PostgreSQL with Prisma ORM
- **APIs**: Google Calendar API, Google Meet API
- **Security**: AES-256-GCM encryption for refresh tokens
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Deployment**: Vercel with CI/CD via GitHub Actions

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Google Cloud Console project with Calendar API enabled
- Google OAuth2 credentials

## 🔧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd NextJsProject
npm install
```

### 2. Database Setup

Set up PostgreSQL database and update the connection string in your environment variables.

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API
4. Create OAuth2 credentials (Web application)
5. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://YOUR_DOMAIN/api/auth/callback/google`
6. Required scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`

### 4. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/scheduler_db"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key-32-chars-min"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id"

# Token Encryption (32+ characters)
TOKEN_ENCRYPTION_KEY="your-32-character-encryption-key!!"

# Production only
VERCEL_URL="your-vercel-domain.vercel.app"
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 🧪 Testing

### Unit and Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### End-to-End Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

## 🚀 Deployment

### Deploy to Vercel

1. **Connect Repository**: Link your GitHub repository to Vercel

2. **Environment Variables**: Add all environment variables in Vercel dashboard:
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-secret
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
   TOKEN_ENCRYPTION_KEY=your-encryption-key
   ```

3. **Database Migration**: Run migrations in production:
   ```bash
   npx prisma migrate deploy
   ```

4. **Google OAuth Update**: Update authorized redirect URIs in Google Console:
   - Add: `https://your-app.vercel.app/api/auth/callback/google`

5. **Deploy**: Push to main branch or deploy manually from Vercel dashboard

### CI/CD Pipeline

The project includes GitHub Actions workflow that:
- Runs unit and integration tests
- Builds the application
- Runs E2E tests
- Uploads test reports

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/           # NextAuth configuration
│   │   ├── availability/   # Seller availability endpoint
│   │   ├── book/          # Booking creation endpoint
│   │   ├── appointments/  # Appointments listing
│   │   └── sellers/       # Sellers listing
│   ├── appointments/      # Appointments page
│   ├── buyer/            # Buyer booking page
│   └── dashboard/        # Seller dashboard
├── lib/
│   ├── availability.ts   # Availability calculation helpers
│   ├── encryption.ts     # Token encryption utilities
│   ├── google.ts         # Google API client setup
│   └── prisma.ts         # Database client
└── __tests__/            # Test files
```

## 🔐 Security Features

- **Encrypted Refresh Tokens**: All Google refresh tokens are encrypted using AES-256-GCM before database storage
- **Secure Session Management**: JWT-based sessions with NextAuth.js
- **API Route Protection**: All sensitive endpoints require authentication
- **Input Validation**: Comprehensive request validation and sanitization
- **Error Handling**: Secure error responses without sensitive information leakage

## 📖 API Documentation

### GET `/api/sellers`
Lists all sellers with optional availability information.

**Query Parameters:**
- `includeAvailability=true` - Include next available slots

### GET `/api/availability`
Get available time slots for a specific seller.

**Query Parameters:**
- `sellerId` (required) - Seller's user ID
- `days` (optional) - Number of days to check (default: 14)

### POST `/api/book`
Create a new appointment booking.

**Request Body:**
```json
{
  "sellerId": "string",
  "startTimeISO": "2024-01-15T10:00:00Z",
  "endTimeISO": "2024-01-15T10:30:00Z"
}
```

### GET `/api/appointments`
Get appointments for the authenticated user.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.
