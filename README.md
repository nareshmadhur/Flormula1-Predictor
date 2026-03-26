# FLO-RMULA 1 Predictions App

A modern, high-performance web application designed for predicting Formula 1 race outcomes. Users can predict the podium finishers (P1, P2, P3) and answer custom bonus questions for each race. Admins can manage the season schedule, score predictions, and maintain the underlying grid roster.

## ✨ Features

### For Users
- **🏎️ Race Predictions**: Predict podium positions (P1, P2, P3) for upcoming F1 races
- **🎯 Bonus Questions**: Answer custom multiple-choice questions for extra points
- **📊 Global Leaderboard**: Track your ranking against other predictors
- **📱 Mobile-First Design**: Fully responsive design optimized for all devices
- **🔒 Secure Authentication**: Supabase-powered user accounts with secure login
- **📈 Personal History**: View your prediction history and performance stats
- **⏰ Smart Lock Times**: Predictions automatically lock 5 minutes before race start

### For Admins
- **⚙️ Race Management**: Create and configure races with custom lock times
- **👥 User Administration**: Manage user accounts and permissions
- **📊 Scoring Engine**: Automated scoring with detailed result tracking
- **🗂️ Reference Data**: Manage drivers, constructors, and circuits
- **📋 Bonus Question Builder**: Create custom questions with multiple options
- **📈 Analytics Dashboard**: Monitor user engagement and prediction trends

## � User Journeys

### New User Registration Journey
1. **Discovery**: User finds the app through social media, racing forums, or search
2. **Sign Up**: User creates account with email/password or social login
3. **Email Verification**: User verifies email address to activate account
4. **Welcome**: User lands on predictions page with guided tour
5. **First Prediction**: User makes their first race prediction
6. **Engagement**: User checks leaderboard and sees their initial ranking

### Regular User Prediction Journey
1. **Login**: User logs in with existing credentials
2. **Browse Races**: User views upcoming races on predictions page
3. **Select Race**: User chooses a race to predict (before lock time)
4. **Make Predictions**: User selects P1, P2, P3 drivers from dropdowns
5. **Answer Bonus Questions**: User answers custom multiple-choice questions
6. **Submit**: User submits predictions with confirmation feedback
7. **Track Progress**: User monitors leaderboard position throughout season

### Admin Management Journey
1. **Admin Login**: Admin logs in with elevated permissions
2. **Dashboard Overview**: Admin views system status and recent activity
3. **Race Management**: Admin creates/configures new races with lock times
4. **Data Maintenance**: Admin updates driver/constructor reference data
5. **Scoring**: Admin scores completed races and bonus questions
6. **User Management**: Admin monitors user activity and handles issues
7. **Analytics Review**: Admin analyzes prediction trends and user engagement

### Mobile User Journey
1. **Mobile Access**: User accesses app on mobile device
2. **Touch Navigation**: User navigates with touch-friendly interface
3. **Quick Predictions**: User makes predictions with optimized mobile forms
4. **Real-time Updates**: User receives push notifications for race results
5. **Social Sharing**: User shares predictions/results on social media

### Power User Journey
1. **Advanced Analysis**: User studies historical data and driver performance
2. **Strategic Predictions**: User makes calculated predictions based on research
3. **Season Planning**: User plans prediction strategy for entire season
4. **Performance Tracking**: User analyzes personal prediction accuracy
5. **Community Engagement**: User discusses strategies with other predictors
## 🔄 User Journey Enhancements

### High Priority Improvements
- **Push Notifications**: Real-time notifications for race results and leaderboard changes
- **Social Features**: Allow users to share predictions and compare with friends
- **Prediction Streaks**: Track and reward consecutive correct predictions
- **Advanced Analytics**: Detailed performance statistics and prediction patterns
- **Race Reminders**: Automated reminders before prediction deadlines

### Medium Priority Improvements
- **Prediction Templates**: Save favorite prediction combinations for quick reuse
- **Historical Comparisons**: Compare current predictions against past performance
- **Driver Insights**: Show driver statistics and recent form
- **Season Challenges**: Special prediction challenges with bonus rewards
- **Mobile App**: Native mobile app for iOS and Android

### Low Priority Improvements
- **AI Predictions**: AI-powered prediction suggestions based on historical data
- **Live Scoring**: Real-time scoring updates during races
- **Prediction Markets**: Allow users to bet virtual points on predictions
- **Custom Leaderboards**: Create private leaderboards for groups/friends
- **Integration APIs**: Third-party integrations with racing data providers

### Technical Enhancements Needed
- **Real-time Updates**: Implement WebSocket connections for live data
- **Caching Strategy**: Optimize database queries and implement Redis caching
- **Progressive Web App**: Add PWA features for offline functionality
- **Advanced Search**: Full-text search for drivers, races, and users
- **Data Visualization**: Interactive charts for performance analytics
## �🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flormula1-predictor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file with your Supabase credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Seed reference data**
   ```bash
   node scripts/seed-official.mjs
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Mobile Responsiveness

This application is fully optimized for mobile devices with:

- **Responsive Design**: Adapts seamlessly from mobile to desktop
- **Touch-Friendly**: All interactive elements meet minimum 44px touch target requirements
- **No Zoom Issues**: Prevents unwanted zoom when focusing form inputs on iOS
- **Optimized Navigation**: Mobile-optimized navbar with proper spacing
- **Readable Typography**: Appropriate font sizes for all screen sizes

## 🏗️ Technical Architecture

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Icons**: Lucide React
- **Deployment**: Optimized for Vercel/Node.js environments
- **Data Fetching**: Server-side rendering with Next.js Server Actions
- **Caching**: Intelligent cache invalidation with `revalidatePath`

## 🗄️ Database Schema

The application uses PostgreSQL with Row Level Security (RLS) ensuring users can only modify their own predictions while allowing public reads on leaderboards and reference data.

### Core Tables
- `profiles` - User profiles and authentication data
- `races` - Race schedule and configuration
- `predictions` - User podium predictions
- `prediction_bonus_answers` - User bonus question responses
- `drivers` - F1 driver information
- `constructors` - F1 team information
- `circuits` - Race circuit details
- `bonus_questions` - Custom questions per race
- `bonus_options` - Answer options for bonus questions
- `race_results` - Official race results
- `race_bonus_answers` - Official bonus question answers
- `user_race_scores` - Individual race scoring
- `leaderboard_cache` - Global leaderboard data

## 🎯 Scoring System

- **Podium Points**: 3 points for exact position, 1 point for correct driver in wrong position
- **Bonus Points**: Configurable points for correct bonus question answers
- **Lock Timing**: Predictions must be submitted before the 5-minute lock period
- **Real-time Updates**: Leaderboard updates immediately after scoring

## 🔧 Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Project Structure
```
├── app/                    # Next.js app directory
│   ├── admin/             # Admin-only pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── leaderboard/       # Leaderboard page
│   ├── predictions/       # User predictions page
│   └── race/[id]/         # Race-specific pages
├── components/            # Reusable React components
├── utils/                 # Utility functions
├── actions/               # Server actions
├── scripts/               # Database seeding scripts
└── supabase/              # Database configuration
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
npm run build
npm run start
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Issues**
- Verify your Supabase credentials in `.env.local`
- Ensure your Supabase project is active
- Check Row Level Security policies

**Build Errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (requires 18+)
- Verify TypeScript types

**Mobile Display Issues**
- Ensure viewport meta tag is present
- Check CSS media queries
- Verify touch target sizes (minimum 44px)

**Authentication Problems**
- Clear browser cache and cookies
- Check Supabase auth configuration
- Verify user roles and permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test thoroughly
4. Run linting: `npm run lint`
5. Commit your changes: `git commit -m 'Add your feature'`
6. Push to your branch: `git push origin feature/your-feature`
7. Create a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Ensure mobile responsiveness
- Test on multiple devices and browsers
- Follow existing code patterns

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Formula 1 for the amazing sport
- Supabase for the excellent backend platform
- Next.js team for the amazing framework
- Tailwind CSS for the utility-first styling approach
