# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## EAS Build: TestFlight and Google Play

To distribute the app via **TestFlight** (iOS) and **Google Play** (Android internal/closed testing):

### Prerequisites

- [Expo account](https://expo.dev). Run `eas login` before building or submitting.
- **Apple Developer Program** ($99/year) for TestFlight
- **Google Play Console** ($25 one-time) for Play Store
- `eas.json` and `app.json` are already configured (production profile, Android `package`, iOS `bundleIdentifier`)

### 1. Set EAS secrets (do not commit env values)

From the `offhrs-mobile` directory, set your build-time env vars as EAS secrets:

```bash
cd offhrs-mobile
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --type string
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --type string
eas secret:create --name EXPO_PUBLIC_APP_URL --value "https://YOUR_NEXTJS_APP_URL" --type string
```

EAS injects these into production builds automatically.

### 2. One-time app setup

- **App Store Connect:** [App Store Connect](https://appstoreconnect.apple.com) → Apps → + → New App. Use bundle ID `com.offhrs.app.offhrs` (must match `app.json`).
- **Google Play Console:** [Play Console](https://play.google.com/console) → Create app. Use package name `com.offhrs.app` (must match `app.json`). Enable Play App Signing when prompted.

### 3. Build and submit

**iOS (TestFlight):**

```bash
eas build --platform ios --profile production
# After build completes:
eas submit --platform ios --profile production --latest
```

Then in App Store Connect → TestFlight, add internal/external testers.

**Android (Play Store internal testing):**

```bash
eas build --platform android --profile production
# After build completes:
eas submit --platform android --profile production --latest
```

Select your Google Service Account (JSON key) and track (e.g. internal testing) when prompted. Add testers in Play Console → Release → Testing → Internal testing.

### 4. Iterating

After code changes, run the same build and submit commands; new builds will appear in TestFlight and Play Console for testers.

---

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
