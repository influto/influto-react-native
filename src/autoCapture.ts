/**
 * InfluTo — opt-in automatic store-purchase capture + historical back-sync.
 *
 * The IAP library (expo-iap or react-native-iap) is pulled at runtime via require(), never
 * imported — so the package adds no dependency, stays tsc-clean, and no-ops safely in Expo Go
 * when neither is present. Reporting is opt-in and deduped on the store identity (the backend
 * is idempotent too), so purchases are never reported twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PurchaseSyncResult } from './types';

/** Local key for the deduped set of already-reported purchase ids (additive). */
const REPORTED_KEY = '@influto/reported_purchases';
/** Cap the persisted dedup set so it can't grow without bound. */
const MAX_REPORTED = 500;

/** A purchase normalized across expo-iap / react-native-iap. */
interface NormalizedPurchase {
  /** Store-stable dedup id: iOS transactionId, Android purchaseToken. */
  dedupId: string;
  platform: 'ios' | 'android';
  productId?: string;
  /** Best-effort price the user paid (major units), if the IAP lib exposes it on the purchase. */
  price?: number;
  /** Currency for `price` (ISO 4217), if available. */
  currency?: string;
  /** iOS StoreKit2 signed transaction (JWS). */
  jws?: string;
  /** Android Play Billing purchase token. */
  token?: string;
}

/** The proof a normalized purchase carries, for `report`. */
export interface CapturedPurchase {
  platform: 'ios' | 'android';
  signedTransaction?: string;
  purchaseToken?: string;
  /** Android one-time products only (routes to one-time validation). */
  productId?: string;
  price?: number;
  currency?: string;
}

type ReportFn = (p: CapturedPurchase) => Promise<unknown>;
type LogFn = (msg: string, ...rest: any[]) => void;

/**
 * Thin handle over whichever IAP lib is present. `null` if neither is installed
 * (Expo Go / RC-only apps) — every method then degrades to a logged no-op.
 */
interface IapBackend {
  name: 'expo-iap' | 'react-native-iap';
  mod: any;
}

/** Probe expo-iap first, then react-native-iap. Never throws. */
function resolveBackend(): IapBackend | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-iap');
    if (mod && typeof mod.purchaseUpdatedListener === 'function') {
      return { name: 'expo-iap', mod };
    }
  } catch {
    // not installed — fall through
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-iap');
    const m = mod?.default ?? mod;
    if (m && typeof m.purchaseUpdatedListener === 'function') {
      return { name: 'react-native-iap', mod: m };
    }
  } catch {
    // not installed — fall through
  }
  return null;
}

/**
 * Normalize a raw purchase from either lib into our shape. Returns null if the
 * purchase carries no usable proof (e.g. a pending/partial record).
 */
function normalize(raw: any): NormalizedPurchase | null {
  if (!raw) return null;
  const rawPlatform: string | undefined = raw.platform ?? raw.platformEnum ?? undefined;
  // expo-iap exposes jwsRepresentationIos; react-native-iap (v12+) the same. For
  // store-direct we REQUIRE the JWS, so we only treat a JWS-looking value as iOS proof.
  const jws: string | undefined =
    raw.jwsRepresentationIos ??
    raw.verificationResultIOS ??
    (typeof raw.purchaseToken === 'string' && raw.purchaseToken.split('.').length === 3
      ? raw.purchaseToken // expo-iap returns the JWS in purchaseToken on iOS
      : undefined);
  const token: string | undefined =
    typeof raw.purchaseToken === 'string' && raw.purchaseToken.split('.').length !== 3
      ? raw.purchaseToken
      : raw.purchaseTokenAndroid ?? undefined;

  const isIos = rawPlatform === 'ios' || (!!jws && !token);
  const platform: 'ios' | 'android' = isIos ? 'ios' : 'android';

  const dedupId: string | undefined =
    platform === 'ios'
      ? raw.id ?? raw.transactionId ?? raw.originalTransactionIdentifierIOS ?? jws
      : token ?? raw.id ?? raw.transactionId;

  if (!dedupId) return null;
  if (platform === 'ios' && !jws) return null;
  if (platform === 'android' && !token) return null;

  // Best-effort price (some libs put it on the purchase; otherwise undefined → backend reserves
  // $0 for an auto-captured one-time, logged. Use manual reportPurchase for precise pricing).
  const price: number | undefined =
    typeof raw.price === 'number'
      ? raw.price
      : typeof raw.priceAmountMicros === 'string' || typeof raw.priceAmountMicros === 'number'
        ? Number(raw.priceAmountMicros) / 1_000_000
        : undefined;
  const currency: string | undefined = raw.currency ?? raw.currencyCode ?? undefined;

  return {
    dedupId: String(dedupId),
    platform,
    productId: raw.productId ?? raw.id,
    price,
    currency,
    jws,
    token,
  };
}

/** Load the persisted dedup set. Fail-soft → empty set. */
async function loadReported(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(REPORTED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the dedup set, capped to the most-recent MAX_REPORTED ids. */
async function saveReported(set: Set<string>): Promise<void> {
  try {
    let arr = Array.from(set);
    if (arr.length > MAX_REPORTED) arr = arr.slice(arr.length - MAX_REPORTED);
    await AsyncStorage.setItem(REPORTED_KEY, JSON.stringify(arr));
  } catch {
    // dedup persistence is best-effort; backend idempotency is the backstop.
  }
}

/**
 * The opt-in auto-capture controller. One instance lives on the SDK singleton.
 * All methods are no-throw; failures are logged at debug level.
 */
export class AutoPurchaseCapture {
  private backend: IapBackend | null = null;
  private updateSub: { remove?: () => void } | null = null;
  private errorSub: { remove?: () => void } | null = null;
  private enabled = false;
  /** Host-declared one-time / consumable product ids (the purchase carries no type). */
  private oneTimeProductIds = new Set<string>();

  constructor(
    private readonly report: ReportFn,
    private readonly log: LogFn,
  ) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Begin listening to the store purchase stream + (by default) run a one-time
   * back-sync of existing purchases. No-op (logged) if no IAP lib is present.
   */
  async enable(opts?: {
    backSync?: boolean;
    oneTimeProductIds?: string[];
  }): Promise<PurchaseSyncResult> {
    const empty: PurchaseSyncResult = { fetched: 0, sent: 0, failed: 0 };
    if (opts?.oneTimeProductIds) this.oneTimeProductIds = new Set(opts.oneTimeProductIds);
    if (this.enabled) {
      this.log('Auto purchase capture already enabled');
      return empty;
    }
    this.backend = resolveBackend();
    if (!this.backend) {
      this.log(
        'Auto purchase capture: neither expo-iap nor react-native-iap is installed — no-op (safe in Expo Go).',
      );
      return empty;
    }
    this.enabled = true;
    this.log(`Auto purchase capture enabled via ${this.backend.name}`);

    const mod = this.backend.mod;
    try {
      this.updateSub = mod.purchaseUpdatedListener(async (raw: any) => {
        const n = normalize(raw);
        if (!n) return;
        try {
          await this.reportOne(n);
        } catch (e) {
          this.log('purchaseUpdated report error', e);
        }
      });
    } catch (e) {
      this.log('purchaseUpdatedListener registration failed', e);
    }
    try {
      if (typeof mod.purchaseErrorListener === 'function') {
        this.errorSub = mod.purchaseErrorListener((err: any) =>
          this.log('purchaseErrorListener', err),
        );
      }
    } catch {
      // optional — ignore
    }

    if (opts?.backSync === false) return empty;
    return this.syncExisting();
  }

  /** Tear down the listeners. Does NOT clear the dedup set. */
  disable(): void {
    try {
      this.updateSub?.remove?.();
      this.errorSub?.remove?.();
    } catch (e) {
      this.log('disable error', e);
    }
    this.updateSub = null;
    this.errorSub = null;
    this.enabled = false;
    this.log('Auto purchase capture disabled');
  }

  /**
   * One-time sweep of EXISTING purchases. Reports each non-deduped purchase.
   * Safe to call repeatedly — dedup makes re-runs cheap no-ops.
   */
  async syncExisting(): Promise<PurchaseSyncResult> {
    const result: PurchaseSyncResult = { fetched: 0, sent: 0, failed: 0 };
    const backend = this.backend ?? resolveBackend();
    if (!backend) {
      this.log('syncExistingPurchases: no IAP lib present — no-op.');
      return result;
    }
    const mod = backend.mod;
    let raws: any[] = [];
    try {
      if (typeof mod.getAvailablePurchases === 'function') {
        raws = (await mod.getAvailablePurchases()) ?? [];
      } else if (typeof mod.getPurchaseHistories === 'function') {
        raws = (await mod.getPurchaseHistories()) ?? [];
      } else if (typeof mod.getPurchaseHistory === 'function') {
        raws = (await mod.getPurchaseHistory()) ?? [];
      }
    } catch (e) {
      this.log('getAvailablePurchases failed', e);
      return result;
    }
    result.fetched = raws.length;
    for (const raw of raws) {
      const n = normalize(raw);
      if (!n) continue;
      try {
        const sent = await this.reportOne(n);
        if (sent) result.sent += 1;
      } catch (e) {
        result.failed += 1;
        this.log('back-sync report failed', e);
      }
    }
    this.log(
      `back-sync complete: fetched=${result.fetched} sent=${result.sent} failed=${result.failed}`,
    );
    return result;
  }

  /**
   * Report one normalized purchase unless already deduped. Returns true if it was
   * newly reported, false if skipped as a duplicate. Throws on report failure (so
   * callers can count it as `failed`).
   */
  private async reportOne(n: NormalizedPurchase): Promise<boolean> {
    const reported = await loadReported();
    if (reported.has(n.dedupId)) return false;
    // iOS routes by the JWS type (no productId). For Android, a declared one-time product
    // sends productId (routes to one-time validation) + best-effort price; subscriptions don't.
    const oneTime =
      n.platform === 'android' && !!n.productId && this.oneTimeProductIds.has(n.productId);
    await this.report({
      platform: n.platform,
      signedTransaction: n.jws,
      purchaseToken: n.token,
      productId: oneTime ? n.productId : undefined,
      price: oneTime ? n.price : undefined,
      currency: oneTime ? n.currency : undefined,
    });
    reported.add(n.dedupId);
    await saveReported(reported);
    return true;
  }
}
