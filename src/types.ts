/**
 * InfluTo SDK Types
 */

export interface InfluToConfig {
  /**
   * Your InfluTo API key from dashboard
   */
  apiKey: string;

  /**
   * Enable debug logging (useful during development)
   */
  debug?: boolean;

  /**
   * Your app's version string (e.g. from `expo-application` or
   * `react-native-device-info`). Reported on `/sdk/init` for telemetry.
   * Optional — defaults to "unknown".
   */
  appVersion?: string;

  /**
   * Automatically capture + report store purchases (store-direct apps only). Default `true`.
   * When on, the SDK reports purchases from `expo-iap` / `react-native-iap` automatically —
   * no manual `reportPurchase` needed. It activates only when the backend reports the app is
   * store-direct (RevenueCat apps are unaffected) and an IAP lib is present (Expo-Go-safe).
   * Set `false` to manage purchase reporting yourself.
   */
  autoCapture?: boolean;

  /**
   * Your one-time / consumable Android product ids. A Play purchase carries no product TYPE,
   * so default-on auto-capture can only route a one-time product to one-time validation (vs
   * subscription) if its id is listed here. iOS needs nothing (the JWS carries the type). Omit
   * if you only sell subscriptions.
   */
  oneTimeProductIds?: string[];

  /**
   * @internal - Custom API URL (not for public use)
   */
  apiUrl?: string;
}

export interface AttributionResult {
  /**
   * Whether user was attributed to a referral
   */
  attributed: boolean;

  /**
   * Referral code if attributed
   */
  referralCode?: string;

  /**
   * Attribution method used
   */
  attributionMethod?: string;

  /**
   * When referral link was clicked
   */
  clickedAt?: string;

  /**
   * Attribution confidence (0.0-1.0)
   */
  confidence?: number;

  /**
   * Message explaining result
   */
  message?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  /**
   * Influencer commission rate for this campaign (percent). Snake_case because
   * `getActiveCampaigns()` returns the raw `/sdk/campaigns` response verbatim.
   */
  commission_percentage?: number;
}

export interface TrackEventOptions {
  /**
   * Event name
   */
  eventType: string;

  /**
   * User identifier (RevenueCat ID or custom)
   */
  appUserId: string;

  /**
   * Custom event properties
   */
  properties?: Record<string, any>;

  /**
   * Associated referral code
   */
  referralCode?: string;

  /**
   * Optional client-generated idempotency key (uuid v4 recommended).
   *
   * If you pass the same eventId twice (e.g. a useEffect retry, a
   * RevenueCat customerInfo update listener re-firing on app foreground,
   * or any other accidental double-call) the backend short-circuits to
   * a no-op return — the dashboard counts the event exactly once.
   *
   * When omitted, the SDK auto-generates one per `trackEvent` call.
   * Pass an explicit eventId only when you want host-app-controlled
   * dedup (e.g. "this purchase result, no matter how many times the
   * callback fires, should produce exactly one event").
   */
  eventId?: string;
}

export interface DeviceInfo {
  platform: 'ios' | 'android';
  deviceId?: string;
  deviceBrand?: string;
  deviceModel?: string;
  osVersion?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export interface CodeValidationResult {
  /**
   * Whether the code is valid
   */
  valid: boolean;

  /**
   * Normalized code (uppercase)
   */
  code?: string;

  /**
   * Campaign information if valid
   */
  campaign?: {
    id: string;
    name: string;
    description?: string;
    commission_percentage: number;
    campaign_type: string;
  };

  /**
   * Influencer information if available.
   *
   * @deprecated `name` is the influencer's personal name — don't display it to end
   * users by default. `ReferralCodeInput` shows only the campaign name unless you opt
   * in via `showReferrerName` (and your influencers have consented). The field is kept
   * for back-compat.
   */
  influencer?: {
    name: string;
    social_handle?: string;
    follower_count?: number;
  };

  /**
   * Custom campaign data (for conditional offers)
   */
  custom_data?: Record<string, any>;

  /**
   * Success message
   */
  message?: string;

  /**
   * Error message if invalid
   */
  error?: string;

  /**
   * Error code for programmatic handling
   */
  error_code?: 'INVALID_FORMAT' | 'CODE_NOT_FOUND' | 'CODE_EXPIRED' | 'NETWORK_ERROR';
}

export interface SetCodeResult {
  /**
   * Whether code was set successfully
   */
  success: boolean;

  /**
   * Normalized code
   */
  code?: string;

  /**
   * Success/error message
   */
  message: string;

  /**
   * Campaign info
   */
  campaign?: {
    id: string;
    name: string;
  };

  /** True when this code is a developer free-access (comp) code, not an affiliate code. */
  freeAccess?: boolean;
  /** True when the backend granted native premium access for this redemption. */
  grantsAccess?: boolean;
  /** The granted entitlement id/lookup-key, if any. */
  entitlement?: string;
  /** ISO-8601 expiry of the comp, or undefined for an open-ended grant. */
  expiresAt?: string;
}

/** Result of {@link InfluTo.checkAccess} — server-authoritative premium access (comp). */
export interface AccessResult {
  /** Whether InfluTo currently grants this user premium access (platform-independent comp). */
  hasAccess: boolean;
  /** Access source: 'comp' or undefined. */
  source?: string;
  /** Granted entitlement id/lookup-key, if any. */
  entitlement?: string;
  /** ISO-8601 expiry, or undefined for open-ended. */
  expiresAt?: string;
  /** The free code that granted access, if any. */
  code?: string;
}

export interface ReportPurchaseOptions {
  /**
   * 'ios' | 'android'. Defaults to the current platform (Platform.OS).
   */
  platform?: 'ios' | 'android';

  /**
   * iOS: the StoreKit 2 `Transaction.jwsRepresentation` (the SIGNED JWS, not
   * the decoded jsonRepresentation). The backend re-verifies the signature.
   */
  signedTransaction?: string;

  /**
   * Android: the Google Play Billing `purchaseToken`
   * (`Purchase.getPurchaseToken()`).
   */
  purchaseToken?: string;

  /**
   * Android ONE-TIME products only: the Play product id. Google `products.get` needs it;
   * sending it routes the purchase to one-time (NON_RENEWING_PURCHASE) validation.
   * Omit for subscriptions.
   */
  productId?: string;

  /** Android one-time price the user paid (major units), from BillingClient ProductDetails. */
  price?: number;

  /** Currency for `price` (ISO 4217), from ProductDetails.priceCurrencyCode. */
  currency?: string;

  /**
   * User identifier. Defaults to the previously identified user
   * (`identifyUser`).
   */
  appUserId?: string;

  /**
   * Referral code to bind this purchase to. Defaults to the SDK-stored
   * `influto_code` (from attribution / `setReferralCode`), so the FIRST
   * transaction binds to the referral and renewals attribute via it.
   */
  referralCode?: string;
}

export interface PurchaseResult {
  /**
   * Whether the store-direct purchase was validated + ingested.
   */
  success: boolean;

  /**
   * The provider that validated the purchase: 'apple' | 'google'.
   * (A STRING — not a boolean.)
   */
  validated?: string;

  /**
   * 'PRODUCTION' | 'SANDBOX'.
   */
  environment?: string;

  /**
   * The normalized event type processed (e.g. 'INITIAL_PURCHASE').
   */
  event_type?: string;

  /**
   * Opaque pipeline result from the backend.
   */
  result?: Record<string, any>;
}

/**
 * Result of a one-time back-sync of existing store purchases
 * (`syncExistingPurchases` / the back-sync run by `enableAutoPurchaseCapture`).
 *
 * `fetched` — purchases the store returned.
 * `sent`    — newly reported to InfluTo (excludes ones already deduped from a prior run).
 * `failed`  — purchases whose `reportPurchase` call threw.
 */
export interface PurchaseSyncResult {
  fetched: number;
  sent: number;
  failed: number;
}

/**
 * Options for {@link InfluTo.enableAutoPurchaseCapture}.
 */
export interface AutoPurchaseCaptureOptions {
  /**
   * Run the one-time historical back-sync when enabling. Default `true`.
   * Set `false` to ONLY listen for new purchases (no sweep of existing ones).
   */
  backSync?: boolean;

  /**
   * Your one-time / consumable Android product ids. The Play purchase carries no product
   * TYPE, so the SDK can only route a purchase to one-time validation (vs subscription) if
   * you list its product id here. iOS needs nothing (the JWS carries the type). Omit if you
   * only sell subscriptions.
   */
  oneTimeProductIds?: string[];
}
