/**
 * InfluTo SDK for React Native
 *
 * Track influencer referrals and conversions in your mobile app
 *
 * @example
 * ```typescript
 * import InfluTo from '@influto/react-native-sdk';
 *
 * // Initialize (same key for dev & production)
 * await InfluTo.initialize({
 *   apiKey: 'it_abc123...',
 *   debug: __DEV__  // Enable logging in development
 * });
 *
 * // Check attribution
 * const attribution = await InfluTo.checkAttribution();
 * if (attribution.attributed) {
 *   console.log('User came from referral:', attribution.referralCode);
 * }
 * ```
 */

import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  InfluToConfig,
  AttributionResult,
  Campaign,
  TrackEventOptions,
  DeviceInfo,
  CodeValidationResult,
  SetCodeResult,
  ReportPurchaseOptions,
  PurchaseResult,
  AccessResult,
  PurchaseSyncResult,
  AutoPurchaseCaptureOptions
} from './types';
import { AutoPurchaseCapture } from './autoCapture';

/** SDK version reported on /sdk/init — keep in sync with package.json. */
const SDK_VERSION = '1.5.0';

const STORAGE_PREFIX = '@influto/';
const STORAGE_KEYS = {
  ATTRIBUTION: `${STORAGE_PREFIX}attribution`,
  APP_USER_ID: `${STORAGE_PREFIX}app_user_id`,
  INFLUTO_CODE: `${STORAGE_PREFIX}influto_code`,
  SDK_INITIALIZED: `${STORAGE_PREFIX}initialized`,
  ACCESS: `${STORAGE_PREFIX}access`,
};

/** checkAccess() positive-result cache TTL (ms). A negative result is never cached. */
const ACCESS_TTL_MS = 5 * 60 * 1000;

/**
 * RFC4122 v4 uuid using Math.random() — sufficient for an idempotency key
 * (collision space is 2^122; bug surface is "host app fires the same event
 * twice in a millisecond", not adversarial). Avoids pulling in `uuid` or
 * `crypto.getRandomValues` which aren't uniformly available in RN runtimes.
 */
function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class InfluToSDK {
  private config: InfluToConfig | null = null;
  private apiUrl: string = 'https://influ.to/api';
  private isInitialized: boolean = false;
  /** Lazily created when the host opts in to auto purchase capture. */
  private autoCapture: AutoPurchaseCapture | null = null;

  /**
   * Initialize InfluTo SDK
   *
   * Call this once when your app starts, after user grants tracking permission
   */
  async initialize(config: InfluToConfig): Promise<void> {
    this.config = config;

    // Use custom API URL if provided (internal testing only)
    if (config.apiUrl) {
      this.apiUrl = config.apiUrl;
    }

    if (config.debug) {
      console.log('[InfluTo] Initializing SDK...');
      console.log('[InfluTo] API URL:', this.apiUrl);
    }

    try {
      // Call init endpoint
      const response = await this.apiRequest('/sdk/init', {
        method: 'POST',
        body: JSON.stringify({
          app_version: config.appVersion || 'unknown',
          sdk_version: SDK_VERSION,
          platform: Platform.OS
        })
      });

      if (response.initialized) {
        this.isInitialized = true;
        await AsyncStorage.setItem(STORAGE_KEYS.SDK_INITIALIZED, 'true');

        if (config.debug) {
          console.log('[InfluTo] SDK initialized successfully');
          console.log('[InfluTo] Active campaigns:', response.campaigns?.length || 0);
        }

        // Auto-capture purchases by default for store-direct apps (near one-line integration).
        // The backend's `store_direct` flag keeps RevenueCat apps silent. Opt out with
        // `autoCapture: false`. Fire-and-forget so init isn't blocked by the back-sync.
        if (config.autoCapture !== false && response.store_direct) {
          this.getAutoCapture()
            .enable({ oneTimeProductIds: config.oneTimeProductIds })
            .catch(() => { /* fail-soft: never break init */ });
        }
      }
    } catch (error) {
      console.error('[InfluTo] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if current user has attribution to a referral

   *
   * Call this during app onboarding to see if user should get trial/discount
   *
   * @returns Attribution result with referral code if attributed
   */
  async checkAttribution(): Promise<AttributionResult> {
    if (!this.isInitialized) {
      throw new Error('InfluTo SDK not initialized. Call InfluTo.initialize() first.');
    }

    try {
      // Check if already stored locally
      const storedAttribution = await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION);
      if (storedAttribution) {
        if (this.config?.debug) {
          console.log('[InfluTo] Attribution found in storage');
        }
        return JSON.parse(storedAttribution);
      }

      // Track install and check attribution
      const deviceInfo = await this.getDeviceInfo();

      const response = await this.apiRequest('/sdk/track-install', {
        method: 'POST',
        body: JSON.stringify(deviceInfo)
      });

      if (response.attributed && response.referral_code) {
        const attribution: AttributionResult = {
          attributed: true,
          referralCode: response.referral_code,
          attributionMethod: response.attribution_method,
          clickedAt: response.clicked_at,
          message: response.message
        };

        // Store for future use
        await AsyncStorage.setItem(STORAGE_KEYS.ATTRIBUTION, JSON.stringify(attribution));
        await AsyncStorage.setItem(STORAGE_KEYS.INFLUTO_CODE, response.referral_code);

        // 🎯 AUTO-INTEGRATION: Set RevenueCat attributes if available
        // Sets both influto_code and influto_referral flag for RevenueCat Targeting
        try {
          // @ts-ignore - RevenueCat might not be installed
          const Purchases = require('react-native-purchases').default;
          if (Purchases && Purchases.setAttributes) {
            await Purchases.setAttributes({
              influto_code: response.referral_code,
              influto_referral: 'true'  // Flag for RevenueCat Targeting rules
            });
            if (this.config?.debug) {
              console.log('[InfluTo] ✅ RevenueCat attributes set: influto_code + influto_referral=true');
            }
          }
        } catch (e) {
          // RevenueCat not installed - that's okay, developer can set manually
          if (this.config?.debug) {
            console.log('[InfluTo] RevenueCat not found - set influto_code manually');
          }
        }

        if (this.config?.debug) {
          console.log('[InfluTo] ✅ Attribution found:', response.referral_code);
        }

        return attribution;
      } else {
        if (this.config?.debug) {
          console.log('[InfluTo] No attribution found (organic install)');
        }

        return {
          attributed: false,
          message: response.message || 'No attribution found'
        };
      }
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Error checking attribution:', error);
      }
      return {
        attributed: false,
        message: 'Error checking attribution'
      };
    }
  }

  /**
   * Identify user with app_user_id
   *
   * Call this when you have the user's RevenueCat ID or custom user ID
   */
  async identifyUser(appUserId: string, properties?: Record<string, any>): Promise<void> {
    if (!this.isInitialized) {
      if (this.config?.debug) {
        console.warn('[InfluTo] SDK not initialized');
      }
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.APP_USER_ID, appUserId);

    try {
      await this.apiRequest('/sdk/identify', {
        method: 'POST',
        body: JSON.stringify({
          app_user_id: appUserId,
          properties: properties || {}
        })
      });

      if (this.config?.debug) {
        console.log('[InfluTo] User identified:', appUserId);
      }
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Error identifying user:', error);
      }
    }
  }

  /**
   * Track custom event
   *
   * Use this to track key events like trial_started, paywall_viewed, etc.
   *
   * Idempotency: every call gets a generated `eventId` (uuid v4) if the
   * caller didn't provide one. The backend uses it to suppress duplicate
   * POSTs — so accidental double-fires from React useEffect / RC update
   * listeners produce exactly one row instead of N.
   */
  async trackEvent(options: TrackEventOptions): Promise<void> {
    if (!this.isInitialized) {
      if (this.config?.debug) {
        console.warn('[InfluTo] SDK not initialized');
      }
      return;
    }

    // Auto-generate idempotency key if caller didn't supply one. Without
    // this, a host app firing trackEvent twice (e.g. inside a customerInfo
    // listener that also runs after Purchases.purchasePackage resolves)
    // produces 2 rows in sdk_events — the bug we're defending against.
    const payload = {
      ...options,
      eventId: options.eventId ?? generateUuidV4(),
    };

    try {
      await this.apiRequest('/sdk/event', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (this.config?.debug) {
        console.log('[InfluTo] Event tracked:', options.eventType, 'id:', payload.eventId);
      }
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Error tracking event:', error);
      }
    }
  }

  /**
   * Get active campaigns
   *
   * Useful for showing available promotions in-app
   */
  async getActiveCampaigns(): Promise<Campaign[]> {
    if (!this.isInitialized) {
      return [];
    }

    try {
      const response = await this.apiRequest('/sdk/campaigns');
      return response || [];
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Error fetching campaigns:', error);
      }
      return [];
    }
  }

  /**
   * Get stored InfluTo code (if any)
   */
  async getReferralCode(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.INFLUTO_CODE);
  }

  /**
   * Get prefilled referral code (if user came via attribution link)
   *
   * Use this to pre-fill a promo code input field
   *
   * @returns Referral code if attribution exists, null otherwise
   */
  async getPrefilledCode(): Promise<string | null> {
    const attribution = await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION);

    if (attribution) {
      const parsed = JSON.parse(attribution);
      return parsed.attributed ? parsed.referralCode : null;
    }

    return null;
  }

  /**
   * Validate a referral/promo code
   *
   * Check if a code is valid without applying it.
   * Use this when user manually enters a code in your app.
   *
   * @param code - The referral code to validate
   * @returns Validation result with campaign info if valid
   *
   * @example
   * ```typescript
   * const result = await InfluTo.validateCode('FITGURU30');
   *
   * if (result.valid) {
   *   console.log('Campaign:', result.campaign.name);
   *   console.log('Commission:', result.campaign.commission_percentage + '%');
   *   // Show custom offer based on campaign
   * } else {
   *   console.log('Invalid code:', result.error);
   * }
   * ```
   */
  async validateCode(code: string): Promise<CodeValidationResult> {
    if (!this.isInitialized) {
      return {
        valid: false,
        error: 'SDK not initialized',
        error_code: 'NETWORK_ERROR'
      };
    }

    try {
      const response = await this.apiRequest('/sdk/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });

      return response as CodeValidationResult;
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Code validation failed:', error);
      }

      return {
        valid: false,
        error: 'Network error or invalid response',
        error_code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Manually set a referral code
   *
   * Use this when user enters a promo code manually (not from link click).
   * This will:
   * 1. Store the code locally
   * 2. Set it in RevenueCat attributes automatically
   * 3. Record the attribution with backend
   *
   * @param code - The referral code to set
   * @param appUserId - Optional user ID (if available)
   * @returns Result with success status
   *
   * @example
   * ```typescript
   * // User enters code manually
   * const result = await InfluTo.setReferralCode('FITGURU30');
   *
   * if (result.success) {
   *   console.log('Code applied successfully');
   *   // Show appropriate paywall/offer
   * }
   * ```
   */
  async setReferralCode(code: string, appUserId?: string): Promise<SetCodeResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: 'SDK not initialized'
      };
    }

    const normalizedCode = code.trim().toUpperCase();

    try {
      // Store locally
      await AsyncStorage.setItem(STORAGE_KEYS.INFLUTO_CODE, normalizedCode);

      // Store attribution record
      const attribution: AttributionResult = {
        attributed: true,
        referralCode: normalizedCode,
        attributionMethod: 'manual_entry',
        clickedAt: new Date().toISOString(),
        message: 'Manually entered code'
      };
      await AsyncStorage.setItem(STORAGE_KEYS.ATTRIBUTION, JSON.stringify(attribution));

      // Set in RevenueCat automatically
      // Sets both influto_code and influto_referral flag for RevenueCat Targeting
      try {
        const Purchases = require('react-native-purchases').default;
        if (Purchases && Purchases.setAttributes) {
          await Purchases.setAttributes({
            influto_code: normalizedCode,
            influto_referral: 'true'  // Flag for RevenueCat Targeting rules
          });

          if (this.config?.debug) {
            console.log('[InfluTo] ✅ RevenueCat attributes set: influto_code + influto_referral=true');
          }
        }
      } catch (e) {
        if (this.config?.debug) {
          console.warn('[InfluTo] RevenueCat not available - set manually');
        }
      }

      // Record with backend
      const response = await this.apiRequest('/sdk/set-referral-code', {
        method: 'POST',
        body: JSON.stringify({
          code: normalizedCode,
          app_user_id: appUserId
        })
      });

      return {
        success: response.success === true,
        code: response.code,
        message: response.message,
        campaign: response.campaign,
        // Comp / free-access fields (present when the code is a developer free-access code).
        freeAccess: response.free_access ?? undefined,
        grantsAccess: response.grants_access ?? undefined,
        entitlement: response.entitlement ?? undefined,
        expiresAt: response.expires_at ?? undefined,
      };
    } catch (error) {
      if (this.config?.debug) {
        console.error('[InfluTo] Failed to set referral code:', error);
      }

      return {
        success: false,
        message: 'Failed to set code: ' + (error as Error).message
      };
    }
  }

  /**
   * Validate and apply a referral code (combined operation)
   *
   * This is a convenience method that validates a code and applies it if valid.
   * Use this for one-step validation + application.
   *
   * @param code - The referral code to validate and apply
   * @param appUserId - Optional user ID
   * @returns Validation result. If valid, code is automatically applied.
   *
   * @example
   * ```typescript
   * const result = await InfluTo.applyCode('FITGURU30', userId);
   *
   * if (result.valid) {
   *   // Code validated AND applied automatically
   *   showCustomOffer(result.campaign);
   * } else {
   *   Alert.alert('Invalid Code', result.error);
   * }
   * ```
   */
  async applyCode(code: string, appUserId?: string): Promise<CodeValidationResult & { applied?: boolean }> {
    // First validate
    const validation = await this.validateCode(code);

    if (!validation.valid) {
      return { ...validation, applied: false };
    }

    // If valid, apply it
    const setResult = await this.setReferralCode(code, appUserId);

    return {
      ...validation,
      applied: setResult.success
    };
  }

  /**
   * Server-authoritative premium-access check (platform-independent comp).
   *
   * Returns whether InfluTo currently grants this user free/premium access — works for BOTH
   * RevenueCat and store-direct apps. Recommended premium gate:
   *   `const premium = rcEntitlementActive || (await InfluTo.checkAccess(uid)).hasAccess;`
   *
   * Fail-soft: any error returns `{ hasAccess: false }`. Caches a positive result locally for
   * a few minutes (a negative result is never cached, so a freshly-redeemed comp appears
   * immediately).
   */
  async checkAccess(appUserId?: string): Promise<AccessResult> {
    if (!this.isInitialized) return { hasAccess: false };
    try {
      const uid =
        appUserId ?? (await AsyncStorage.getItem(STORAGE_KEYS.APP_USER_ID)) ?? undefined;
      if (!uid) return { hasAccess: false };

      const cached = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS);
      if (cached) {
        const { result, ts, uid: cachedUid } = JSON.parse(cached);
        if (cachedUid === uid && Date.now() - ts < ACCESS_TTL_MS && result?.hasAccess) {
          return result as AccessResult;
        }
      }

      const response = await this.apiRequest(
        `/sdk/access?app_user_id=${encodeURIComponent(uid)}`
      );
      const result: AccessResult = {
        hasAccess: response.has_access === true,
        source: response.source ?? undefined,
        entitlement: response.entitlement ?? undefined,
        expiresAt: response.expires_at ?? undefined,
        code: response.code ?? undefined,
      };
      if (result.hasAccess) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.ACCESS,
          JSON.stringify({ result, ts: Date.now(), uid })
        );
      }
      return result;
    } catch (error) {
      if (this.config?.debug) console.error('[InfluTo] checkAccess error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Report a store-direct purchase (no RevenueCat) for attribution + commission.
   *
   * Use this when your app validates purchases DIRECTLY with Apple / Google
   * (instead of RevenueCat). The store-signed proof is verified server-to-server
   * and fed the same commission/wallet pipeline a RevenueCat webhook would.
   *
   *   - iOS: pass `signedTransaction` = StoreKit 2 `Transaction.jwsRepresentation`.
   *   - Android: pass `purchaseToken` = Google Play Billing `Purchase.getPurchaseToken()`.
   *
   * The referral code defaults to the SDK-stored `influto_code`, so the first
   * transaction binds to the referral (renewals/refunds attribute via the store
   * identity). Only enabled for apps configured for store-direct validation;
   * otherwise the backend returns 400 (inert for RevenueCat apps).
   *
   * Throws on failure. A 503 means the FX rate was momentarily unavailable —
   * retry shortly (the response error message includes the status).
   *
   * @example
   * ```typescript
   * // iOS (StoreKit 2)
   * await InfluTo.reportPurchase({ signedTransaction: transaction.jwsRepresentation });
   * // Android (Play Billing)
   * await InfluTo.reportPurchase({ purchaseToken: purchase.purchaseToken });
   * ```
   */
  async reportPurchase(options: ReportPurchaseOptions): Promise<PurchaseResult> {
    if (!this.isInitialized) {
      throw new Error('InfluTo SDK not initialized. Call InfluTo.initialize() first.');
    }

    const platform = (options.platform || Platform.OS).toLowerCase();

    // Default the referral code to the stored influto_code so the first purchase
    // binds to the referral even if the host didn't thread the code through.
    const referralCode =
      options.referralCode ?? (await this.getReferralCode()) ?? undefined;
    const appUserId =
      options.appUserId ?? (await AsyncStorage.getItem(STORAGE_KEYS.APP_USER_ID)) ?? undefined;

    const body: Record<string, any> = { platform };
    if (referralCode) body.referralCode = referralCode;
    if (appUserId) body.appUserId = appUserId;
    if (options.signedTransaction) body.signedTransaction = options.signedTransaction;
    if (options.purchaseToken) body.purchaseToken = options.purchaseToken;
    if (options.productId) body.productId = options.productId;
    if (typeof options.price === 'number') body.price = options.price;
    if (options.currency) body.currency = options.currency;

    const response = await this.apiRequest('/sdk/purchase', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (this.config?.debug) {
      console.log('[InfluTo] Purchase reported:', response?.validated, response?.environment);
    }

    return response as PurchaseResult;
  }

  /** Lazily build the opt-in auto-capture controller, wired to reportPurchase. */
  private getAutoCapture(): AutoPurchaseCapture {
    if (!this.autoCapture) {
      this.autoCapture = new AutoPurchaseCapture(
        (p) =>
          this.reportPurchase({
            platform: p.platform,
            signedTransaction: p.signedTransaction,
            purchaseToken: p.purchaseToken,
            // One-time products carry these (Android); subscriptions leave them undefined.
            productId: p.productId,
            price: p.price,
            currency: p.currency
          }),
        (msg, ...rest) => {
          if (this.config?.debug) console.log(`[InfluTo] ${msg}`, ...rest);
        }
      );
    }
    return this.autoCapture;
  }

  /**
   * OPT-IN: subscribe to the store purchase stream (via the host's `expo-iap` or
   * `react-native-iap`) and auto-`reportPurchase` each new purchase, then (by default)
   * back-sync existing purchases. Deduped. Use only for store-direct apps not already
   * reporting via RevenueCat or manual `reportPurchase`. No-op + Expo-Go-safe if no IAP
   * lib is installed. Returns the back-sync counters `{fetched, sent, failed}`.
   */
  async enableAutoPurchaseCapture(
    opts?: AutoPurchaseCaptureOptions
  ): Promise<PurchaseSyncResult> {
    if (!this.isInitialized) {
      throw new Error('InfluTo SDK not initialized. Call InfluTo.initialize() first.');
    }
    return this.getAutoCapture().enable({
      backSync: opts?.backSync,
      oneTimeProductIds: opts?.oneTimeProductIds,
    });
  }

  /**
   * Stop listening to the store purchase stream. Does not clear the dedup set, so a
   * later re-enable won't re-report already-sent purchases.
   */
  disableAutoPurchaseCapture(): void {
    this.autoCapture?.disable();
  }

  /**
   * Run a one-time sweep of EXISTING store purchases, reporting each not-yet-reported
   * one. Use this when you want the historical back-sync WITHOUT keeping the live
   * listener (e.g. a one-shot reconciliation). Safe to call repeatedly — dedup makes
   * re-runs cheap. No-op (zeros) if no IAP lib is present.
   */
  async syncExistingPurchases(): Promise<PurchaseSyncResult> {
    if (!this.isInitialized) {
      throw new Error('InfluTo SDK not initialized. Call InfluTo.initialize() first.');
    }
    return this.getAutoCapture().syncExisting();
  }

  /**
   * Clear stored attribution data
   *
   * Useful for testing or user logout
   */
  async clearAttribution(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ATTRIBUTION,
      STORAGE_KEYS.INFLUTO_CODE,
      STORAGE_KEYS.APP_USER_ID
    ]);
  }

  /**
   * Collect the device signals sent with `/sdk/track-install` for install attribution.
   *
   * Uses ONLY zero-dependency sources available in any RN/Expo runtime:
   *   - `Platform` (OS + OS version)
   *   - `Dimensions` (screen size)
   *   - the built-in `Intl` API (timezone + locale)
   * and OPTIONALLY enriches brand/model/deviceId from `react-native-device-info`
   * if the host app already has it installed.
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    const info: DeviceInfo = { platform: Platform.OS as 'ios' | 'android' };

    // OS version + screen size from RN core (no extra dependency).
    if (Platform.Version != null) {
      info.osVersion = Platform.Version.toString();
    }
    try {
      const { width, height } = Dimensions.get('screen');
      if (width && height) {
        info.screenResolution = `${Math.round(width)}x${Math.round(height)}`;
      }
    } catch {
      // Dimensions unavailable — omit (never send a placeholder string).
    }

    // Timezone + language from the built-in Intl API (no dependency).
    try {
      const opts = Intl.DateTimeFormat().resolvedOptions();
      if (opts.timeZone) info.timezone = opts.timeZone;
      if (opts.locale) info.language = opts.locale;
    } catch {
      // Intl unavailable on some older runtimes — omit.
    }

    // Brand / model / stable device id require the OPTIONAL react-native-device-info
    // package. If the host has it, enrich the device signals; otherwise omit the fields.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-device-info');
      const di = mod?.default ?? mod;
      if (di) {
        if (typeof di.getBrand === 'function') info.deviceBrand = di.getBrand();
        if (typeof di.getModel === 'function') info.deviceModel = di.getModel();
        if (typeof di.getUniqueId === 'function') {
          try {
            info.deviceId = await di.getUniqueId();
          } catch {
            // ignore — deviceId is optional
          }
        }
      }
    } catch {
      // react-native-device-info not installed — fine, fields omitted.
    }

    return info;
  }

  /**
   * Make API request with authentication
   */
  private async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    if (!this.config) {
      throw new Error('SDK not configured');
    }

    const url = `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }
}

// Export singleton instance
const InfluTo = new InfluToSDK();
export default InfluTo;
