# InfluTo React Native SDK

Track influencer referrals and conversions in your React Native app.

## Prerequisites

**You need a free InfluTo account to use this SDK.**

1. Sign up at [https://influ.to](https://influ.to) (free)
2. Create your app in the dashboard
3. Copy your API key from **Settings → API Keys**

Your API key starts with `it_` (e.g., `it_abc123...`)

## Installation

```bash
npm install @influto/react-native-sdk
# or
yarn add @influto/react-native-sdk
```

**Peer Dependencies:**
```bash
npm install @react-native-async-storage/async-storage
```

## Quick Start

### 1. Initialize SDK

```typescript
import InfluTo from '@influto/react-native-sdk';

// In your App.js or root component
await InfluTo.initialize({
  apiKey: 'it_abc123...',  // Get from InfluTo dashboard
  debug: __DEV__  // Enable logging in development
});
```

### 2. Check Attribution

```typescript
// During onboarding, check if user came from a referral
const attribution = await InfluTo.checkAttribution();

if (attribution.attributed) {
  console.log('User came from:', attribution.referralCode);

  // Show trial or special offer
  showTrialPaywall(attribution.referralCode);
} else {
  // Organic user - show regular paywall
  showRegularPaywall();
}
```

### 3. Identify User

```typescript
// After user completes onboarding or you have their ID
await InfluTo.identifyUser('revenuecat_user_id_123');
```

### 4. Track Events (Optional)

```typescript
// Track key events for analytics
await InfluTo.trackEvent({
  eventType: 'trial_started',
  appUserId: 'revenuecat_user_id_123',
  properties: {
    trial_days: 7,
    product_id: 'monthly_subscription'
  }
});
```

## Complete Integration Example

```typescript
import React, { useEffect, useState } from 'react';
import InfluTo from '@influto/react-native-sdk';
import Purchases from 'react-native-purchases';

function App() {
  const [hasReferral, setHasReferral] = useState(false);
  const [referralCode, setReferralCode] = useState(null);

  useEffect(() => {
    async function setupInfluTo() {
      // 1. Initialize InfluTo
      await InfluTo.initialize({
        apiKey: 'it_abc123...',
        debug: __DEV__
      });

      // 2. Check attribution
      const attribution = await InfluTo.checkAttribution();

      if (attribution.attributed) {
        setHasReferral(true);
        setReferralCode(attribution.referralCode);

        // 3. Store in RevenueCat for webhook attribution
        await Purchases.setAttributes({
          'influto_code': attribution.referralCode
        });
      }

      // 4. Identify user when available
      const customerInfo = await Purchases.getCustomerInfo();
      await InfluTo.identifyUser(customerInfo.originalAppUserId);
    }

    setupInfluTo();
  }, []);

  // Show appropriate paywall based on attribution
  const showPaywall = async () => {
    const offerings = await Purchases.getOfferings();

    if (hasReferral) {
      // Show trial offering
      const trialOffering = offerings.all['trial'] || offerings.current;
      await RevenueCatUI.presentPaywall({ offering: trialOffering });

      // Track event
      await InfluTo.trackEvent({
        eventType: 'trial_paywall_shown',
        appUserId: customerInfo.originalAppUserId,
        properties: { influto_code: referralCode }
      });
    } else {
      // Show regular offering
      await RevenueCatUI.presentPaywall();
    }
  };

  return (
    <YourApp hasReferral={hasReferral} onShowPaywall={showPaywall} />
  );
}
```

## API Reference

### `InfluTo.initialize(config)`

Initialize the SDK. Call once when app starts.

**Parameters:**
- `config.apiKey` (required): Your API key from InfluTo dashboard
- `config.debug` (optional): Enable debug logging (defaults to `false`)
- `config.appVersion` (optional): Your app's version string, reported on init for telemetry (defaults to `"unknown"`)
- `config.autoCapture` (optional): Auto-capture and report store purchases (store-direct apps only). Defaults to `true`; set `false` to report purchases yourself. Has no effect on RevenueCat apps.
- `config.oneTimeProductIds` (optional): Your one-time / consumable Android product ids. Needed so auto-capture can route a Play one-time purchase to one-time (vs subscription) validation. iOS needs nothing; omit if you only sell subscriptions.

**Returns:** `Promise<void>`

### `InfluTo.checkAttribution()`

Check if user was referred by an influencer.

**Returns:** `Promise<AttributionResult>`

**Example:**
```typescript
const result = await InfluTo.checkAttribution();
// { attributed: true, referralCode: 'FITGURU25', clickedAt: '2025-12-01T10:30:00Z' }
```

### `InfluTo.identifyUser(appUserId, properties?)`

Identify user with their app user ID.

**Parameters:**
- `appUserId` (required): RevenueCat ID or your custom user ID
- `properties` (optional): Additional user properties

**Returns:** `Promise<void>`

### `InfluTo.trackEvent(options)`

Track custom analytics event.

**Parameters:**
- `options.eventType` (required): Event name
- `options.appUserId` (required): User ID
- `options.properties` (optional): Event properties
- `options.referralCode` (optional): Associated referral code

**Returns:** `Promise<void>`

### `InfluTo.getActiveCampaigns()`

Get list of active campaigns for this app.

**Returns:** `Promise<Campaign[]>`

### `InfluTo.getReferralCode()`

Get stored referral code (if any).

**Returns:** `Promise<string | null>`

### `InfluTo.validateCode(code)`

Validate a referral/promo code without applying it. Use when a user manually enters a code.

**Parameters:**
- `code` (required): The referral code to validate

**Returns:** `Promise<CodeValidationResult>` — `{ valid, campaign?, error?, error_code? }`

### `InfluTo.setReferralCode(code, appUserId?)`

Manually apply a referral code: stores it locally, sets RevenueCat attributes, and records the attribution with the backend.

**Parameters:**
- `code` (required): The referral code to set
- `appUserId` (optional): User ID, if available

**Returns:** `Promise<SetCodeResult>` — `{ success, code?, message, campaign?, freeAccess?, grantsAccess?, entitlement?, expiresAt? }`

### `InfluTo.applyCode(code, appUserId?)`

Validate and apply a code in one step. Validates first; applies only if valid.

**Parameters:**
- `code` (required): The referral code to validate and apply
- `appUserId` (optional): User ID, if available

**Returns:** `Promise<CodeValidationResult & { applied?: boolean }>`

### `InfluTo.checkAccess(appUserId?)`

Server-authoritative premium-access check for InfluTo-granted free/comp access (works for both RevenueCat and store-direct apps). Fail-soft: any error returns `{ hasAccess: false }`. A positive result is cached locally for a few minutes; a negative result is never cached.

**Parameters:**
- `appUserId` (optional): User ID; defaults to the previously identified user

**Returns:** `Promise<AccessResult>` — `{ hasAccess, source?, entitlement?, expiresAt?, code? }`

### `InfluTo.reportPurchase(options)`

Report a store-direct purchase (validated directly with Apple/Google, no RevenueCat) for attribution + commission. The store-signed proof is verified server-to-server. Throws on failure. Inert (backend returns 400) for RevenueCat apps.

**Parameters:**
- `options.signedTransaction` (iOS): StoreKit 2 `Transaction.jwsRepresentation` (the signed JWS)
- `options.purchaseToken` (Android): Google Play Billing `Purchase.getPurchaseToken()`
- `options.productId` (optional, Android one-time): the Play product id
- `options.price` / `options.currency` (optional, Android one-time): amount paid and ISO 4217 currency
- `options.platform` (optional): `'ios' | 'android'` (defaults to current platform)
- `options.appUserId` (optional): defaults to the previously identified user
- `options.referralCode` (optional): defaults to the SDK-stored `influto_code`

**Returns:** `Promise<PurchaseResult>` — `{ success, validated?, environment?, event_type?, result? }`

### `InfluTo.enableAutoPurchaseCapture(opts?)`

Opt-in: subscribe to the store purchase stream (via the host's `expo-iap` / `react-native-iap`) and auto-`reportPurchase` each new purchase, then back-sync existing purchases. Deduped. No-op + Expo-Go-safe if no IAP lib is installed. For store-direct apps only.

**Parameters:**
- `opts.backSync` (optional): run the one-time historical back-sync when enabling (defaults to `true`)
- `opts.oneTimeProductIds` (optional): one-time / consumable Android product ids (see `initialize`)

**Returns:** `Promise<PurchaseSyncResult>` — `{ fetched, sent, failed }`

### `InfluTo.disableAutoPurchaseCapture()`

Stop listening to the store purchase stream. Keeps the dedup set, so re-enabling won't re-report already-sent purchases.

**Returns:** `void`

### `InfluTo.syncExistingPurchases()`

Run a one-time sweep of existing store purchases, reporting each not-yet-reported one — without keeping a live listener. Safe to call repeatedly (deduped). No-op (zeros) if no IAP lib is present.

**Returns:** `Promise<PurchaseSyncResult>` — `{ fetched, sent, failed }`

### `InfluTo.clearAttribution()`

Clear stored attribution data (useful for testing).

**Returns:** `Promise<void>`

## Integration with RevenueCat

InfluTo works seamlessly with RevenueCat:

1. **Store referral code in RevenueCat attributes:**
```typescript
const attribution = await InfluTo.checkAttribution();
if (attribution.attributed) {
  await Purchases.setAttributes({
    'influto_code': attribution.referralCode
  });
}
```

2. **Configure RevenueCat webhook** in InfluTo dashboard

3. **InfluTo automatically tracks** subscription events and calculates commissions

## Platform Support

- ✅ iOS 13.0+
- ✅ Android 5.0+ (API level 21+)
- ✅ Expo (managed & bare workflows)

## Troubleshooting

**Attribution not working?**
- Ensure you called `initialize()` before `checkAttribution()`
- Check API key is correct
- Verify app is configured in InfluTo dashboard
- Check network connectivity

**User not identified?**
- Make sure you call `identifyUser()` after user completes onboarding
- Verify user ID matches what RevenueCat sends in webhooks

## Promo Code Integration

InfluTo supports **manual promo code entry** for users who hear about codes via social media, podcasts, or word-of-mouth.

### Quick Example (Pre-built UI)

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

<ReferralCodeInput
  onValidated={(result) => {
    if (result.valid) {
      navigation.navigate('Paywall');
    }
  }}
  onSkip={() => navigation.navigate('Paywall')}
/>
```

### Quick Example (Headless)

```typescript
import InfluTo from '@influto/react-native-sdk';

// User enters code
const result = await InfluTo.applyCode('FITGURU30', userId);

if (result.valid && result.applied) {
  // Code is validated AND set in RevenueCat automatically
  showPaywall(result.campaign);
}
```

**📚 [Complete Promo Code Guide](./PROMO_CODES.md)** - Examples, customization, best practices

---

## New in v1.5.0

✅ **Store-direct purchase reporting** - `reportPurchase()` for apps validating directly with Apple/Google (no RevenueCat required)
✅ **Names off by default** - `ReferralCodeInput` hides influencer/campaign names unless explicitly opted in
✅ **Fixed device info** - real device/OS/screen/locale data with zero new dependencies

See [CHANGELOG.md](./CHANGELOG.md) for full history.

---

## New in v1.1.0

✅ **Manual promo code entry** - Users can type codes in your app
✅ **Pre-built UI component** - `<ReferralCodeInput />` with full customization
✅ **Headless API** - Build your own UI with `validateCode()`, `setReferralCode()`, `applyCode()`
✅ **Auto-prefill** - Automatically fills code if user came via link
✅ **Custom callbacks** - React to validation results
✅ **Full internationalization** - Customize all labels and messages

---

## Support

- **Documentation:** https://docs.influ.to
- **Help Center:** https://influ.to/help
- **Email:** hello@influ.to
- **Wire contract:** [CONTRACT.md](./CONTRACT.md) — the canonical cross-platform SDK contract

## License

MIT © InfluTo
