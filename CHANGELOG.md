# Changelog

All notable changes to `@influto/react-native-sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-06-15

### Added
- `reportPurchase(options)` — store-direct purchase reporting for apps that
  validate purchases directly with Apple/Google instead of RevenueCat. Pass the
  iOS StoreKit 2 `signedTransaction` (JWS) or the Android Play Billing
  `purchaseToken`; the backend re-verifies the store signature and feeds the same
  commission/attribution pipeline a RevenueCat webhook would. Defaults the
  referral code to the stored `influto_code`. Throws on failure; a `503` means the
  FX rate was momentarily unavailable — retry shortly.
- `ReportPurchaseOptions` and `PurchaseResult` types.
- `'CODE_EXPIRED'` added to the `CodeValidationResult.error_code` union (matches
  the backend `/sdk/validate-code` response and the other InfluTo SDKs).

### Changed
- `ReferralCodeInput` now keeps influencer/campaign names **off by default**.
  `showCampaignName` and `showReferrerName` are opt-in (`false` by default) so the
  influencer's personal name is never disclosed to end users without consent.
- Production error logs in the fail-soft paths (`checkAttribution`,
  `identifyUser`, `trackEvent`, `getActiveCampaigns`) are now gated behind the
  `debug` config flag to avoid noise in release builds.

### Fixed
- Device-signal collection. The previous implementation read
  `require('react-native').DeviceInfo`, which does not exist on the RN core
  module, so every device field was silently `undefined` and `screen_resolution`
  was sent as the literal `"undefinedxundefined"`. Device info now comes from
  zero-dependency sources (`Platform`, `Dimensions`, `Intl`) and optionally
  enriches brand/model/deviceId from `react-native-device-info` if the host app
  already has it installed.

## [1.4.0] - 2026-01-05

### Added
- `appVersion` config option, reported on `/sdk/init` for telemetry.
- Idempotency: `trackEvent` auto-generates a UUID v4 `eventId` when the caller
  omits one, so accidental double-fires produce exactly one event row.

## [1.3.1] - 2026-01-01

### Fixed
- Metro bundler resolution for the `/ui` subpath via a root-level `ui.js` proxy
  and a `react-native` entry in `package.json`.

## [1.1.0]

### Added
- Manual promo code entry: `validateCode()`, `setReferralCode()`, `applyCode()`.
- Pre-built `ReferralCodeInput` UI component (imported from
  `@influto/react-native-sdk/ui`) with full color/font/label customization.
- Auto-prefill of the code when the user arrived via an attribution link.

[1.5.0]: https://github.com/influto/influto-react-native/releases/tag/v1.5.0
[1.4.0]: https://github.com/influto/influto-react-native/releases/tag/v1.4.0
[1.3.1]: https://github.com/influto/influto-react-native/releases/tag/v1.3.1
[1.1.0]: https://github.com/influto/influto-react-native/releases/tag/v1.1.0
