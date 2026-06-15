# InfluTo React Native / Expo Sample

`App.tsx` is a best-practice reference showing the full InfluTo flow:
**1 configure → 2 attribution → 3 referral input → 4 paywall → 5 confirm it landed.**

It uses **RevenueCat**: the SDK sets the
`influto_code` / `influto_referral` attributes, and RevenueCat's webhook to InfluTo
creates the attributed conversion. A **store-direct** variant (no RevenueCat, via
`expo-iap` → `reportPurchase`) is in the commented block at the bottom of `App.tsx`.

## Run it (Expo development build)

IAP needs native code, so this can't run in Expo Go — use a dev build:

```bash
# In your Expo app, install the SDK + RevenueCat:
npx expo install @influto/react-native-sdk react-native-purchases @react-native-async-storage/async-storage
# Drop App.tsx in, then:
npx expo run:ios          # or: npx expo run:android
#   or a cloud build:  eas build --profile development
```

Then paste your **InfluTo API key** + **RevenueCat public SDK key** at runtime
(nothing is committed), enter a **referral code** to test attribution, buy the
current offering, and tap **"Did it land in InfluTo?"** to confirm via the
`/sdk/recent-conversions` endpoint.

## Verify on the backend

`GET /api/apps/{id}/events/recent?environment=SANDBOX` shows the RevenueCat webhook
row with the attributed referral code (the authoritative "conversion landed" signal).

> The published SDK itself is type-checked in CI (`.github/workflows/ci.yml` →
> `npm run build`); this example app is reference code that builds in your own Expo
> project (it depends on `react-native-purchases`, which the SDK does not bundle).
