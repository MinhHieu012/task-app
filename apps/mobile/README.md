# Mobile (Expo)

The iOS/Android app: Expo SDK 58, React Native 0.88, React 19, Expo Router (typed routes), TypeScript. Moved here from the repo root on 2026-11-12 without changing its code, UI or behaviour; see [the migration notes](../../docs/migration/angular-web.md#mobile).

The production web is the Angular app in `apps/web`. This app still contains its wide-screen layout and `react-native-web` (Expo DOM components need it for the rich-text editor), but it is no longer built or deployed for the web.

## Commands

```bash
npm install
cp .env.example .env.local   # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY
npx expo start               # dev server; the phone runs a development build (Expo Go cannot do Google sign-in)
npm run android              # expo run:android (builds and installs the development build)
npm run ios
npm run lint
npm run typecheck
npm test                     # node src/lib/logic.check.ts
```

Android debug APK without a device: `cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`. `android/` is generated (Continuous Native Generation, gitignored): configure native behaviour in `app.json`, and after moving the folder clear `android/app/.cxx` (CMake caches hold absolute paths) or run `npx expo prebuild -p android --clean`.

## Notes

- `src/lib` holds this app's copy of the shared rules. The same rules live framework-free in `packages/core`, used by the web; keep a rule change in both until the mobile app is pointed at `packages/core` (docs/architecture/overview.md, "Sharing").
- DB scripts (`db:push`) moved to the repo root.
- See [AGENTS.md](AGENTS.md) for the Expo-specific rules.
