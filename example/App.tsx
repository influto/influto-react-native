/**
 * InfluTo React Native / Expo sample — best-practice reference.
 *
 * Flow: 1 configure → 2 attribution → 3 referral input (ReferralCodeInput) →
 * 4 paywall (RevenueCat purchase) → 5 confirm it landed in InfluTo.
 *
 * This uses RevenueCat (mode B): the SDK
 * sets `influto_code` / `influto_referral` attributes on the RC user, and RC's
 * webhook to InfluTo creates the attributed conversion (no reportPurchase needed
 * in RC mode). For store-direct (mode A) without RevenueCat, see the snippet at the
 * bottom of this file.
 *
 * Runs in an Expo DEVELOPMENT BUILD (IAP needs native code; Expo Go won't work):
 *   npx expo install react-native-purchases @react-native-async-storage/async-storage
 *   npx expo run:ios            # or run:android, or `eas build --profile development`
 *
 * Paste your keys at runtime — nothing is committed.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import InfluTo from '@influto/react-native-sdk';
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';
import Purchases from 'react-native-purchases';

const BASE_URL = 'https://influ.to/api';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [rcKey, setRcKey] = useState('');
  const [appUserId, setAppUserId] = useState('sample-rn');
  const [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState('Not initialized');
  const [attribution, setAttribution] = useState('—');
  const [result, setResult] = useState('');
  const [landed, setLanded] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoSync, setAutoSync] = useState('');

  async function initialize() {
    try {
      await InfluTo.initialize({ apiKey, debug: true, appVersion: 'sample-rn-1.0' });
      // RevenueCat (mode B). The InfluTo SDK auto-detects react-native-purchases and
      // sets influto_code / influto_referral on attribution / applyCode.
      if (rcKey) await Purchases.configure({ apiKey: rcKey, appUserID: appUserId });
      await InfluTo.identifyUser(appUserId);
      const attr = await InfluTo.checkAttribution();
      setAttribution(
        attr.attributed ? `Attributed → ${attr.referralCode}` : 'Organic (no attribution link)',
      );
      setInitialized(true);
      setStatus(`✅ Initialized as ${appUserId}`);
    } catch (e: any) {
      setInitialized(false);
      setStatus(`❌ Init failed: ${e?.message ?? e}`);
    }
  }

  async function buy() {
    setBusy(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages?.[0];
      if (!pkg) {
        setResult('No RevenueCat offering/package configured.');
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const pro = Object.keys(customerInfo.entitlements.active).length > 0;
      // In RC mode the conversion is created server-side by RC's webhook → InfluTo.
      await InfluTo.trackEvent({ eventType: 'subscription_purchased', appUserId });
      setResult(
        pro
          ? '✅ Purchased (entitlement active). RC webhook will create the attributed conversion.'
          : '⚠️ Purchase finished, no active entitlement.',
      );
    } catch (e: any) {
      setResult(e?.userCancelled ? 'Cancelled' : `❌ ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  // Mode A (store-direct) alternative to manual reportPurchase: let the SDK auto-report
  // purchases from expo-iap / react-native-iap. No-op + Expo-Go-safe if neither is installed.
  async function enableAutoCapture() {
    try {
      const r = await InfluTo.enableAutoPurchaseCapture();
      setAutoSync(
        `Auto-capture enabled · back-sync: fetched=${r.fetched} sent=${r.sent} failed=${r.failed}`,
      );
    } catch (e: any) {
      setAutoSync(`❌ ${e?.message ?? e}`);
    }
  }

  async function checkLanded() {
    try {
      const res = await fetch(
        `${BASE_URL}/sdk/recent-conversions?app_user_id=${encodeURIComponent(appUserId)}&limit=10`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      const json = await res.json();
      if (!res.ok) {
        setLanded(`HTTP ${res.status}: ${JSON.stringify(json)}`);
        return;
      }
      const convs = json.conversions ?? [];
      if (convs.length === 0) {
        setLanded('No purchase recorded yet for this user.');
        return;
      }
      const first = convs[0];
      setLanded(
        `✅ ${json.count} event(s) · ${json.attributed_count} attributed. ` +
          `Latest: ${first.event_type} · ${first.environment} · code=${first.referral_code ?? '—'}`,
      );
    } catch (e: any) {
      setLanded(`Couldn't check: ${e?.message ?? e}`);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>InfluTo Sample</Text>

        <Text style={{ fontWeight: '600', marginTop: 12 }}>1 · Configuration</Text>
        <Field label="InfluTo API key" value={apiKey} onChange={setApiKey} />
        <Field label="RevenueCat public SDK key" value={rcKey} onChange={setRcKey} />
        <Field label="App user ID" value={appUserId} onChange={setAppUserId} />
        <Button title={initialized ? 'Re-initialize' : 'Initialize SDK'} onPress={initialize} />
        <Text>{status}</Text>

        {initialized && (
          <>
            <Text style={{ fontWeight: '600', marginTop: 12 }}>2 · Attribution</Text>
            <Text>Attribution: {attribution}</Text>

            <Text style={{ fontWeight: '600', marginTop: 12 }}>
              3 · Referral code (test attribution)
            </Text>
            <ReferralCodeInput
              appUserId={appUserId}
              showSkipButton={false}
              onApplied={() => InfluTo.getReferralCode().then((c) => setAttribution(`Applied → ${c}`))}
            />

            <Text style={{ fontWeight: '600', marginTop: 12 }}>4 · Paywall (RevenueCat)</Text>
            <Button title="Buy current offering" onPress={buy} disabled={busy} />
            {busy && <ActivityIndicator />}

            <Text style={{ fontWeight: '600', marginTop: 12 }}>5 · Result</Text>
            {!!result && <Text>{result}</Text>}
            <Button title="Did it land in InfluTo?" onPress={checkLanded} />
            {!!landed && <Text>{landed}</Text>}

            <Text style={{ fontWeight: '600', marginTop: 12 }}>6 · Auto-capture (default)</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              On store-direct apps the SDK auto-reports purchases on init (no manual reportPurchase)
              from expo-iap / react-native-iap. This RevenueCat sample isn't store-direct, so it
              stays silent. This button runs an on-demand back-sync to show the counters.
            </Text>
            <Button title="Run back-sync" onPress={enableAutoCapture} />
            {!!autoSync && <Text>{autoSync}</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, color: '#666' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 }}
      />
    </View>
  );
}

/*
 * ─── STORE-DIRECT (mode A, no RevenueCat) ────────────────────────────────────
 * If you validate purchases directly with Apple/Google instead of RevenueCat, buy
 * with `expo-iap` and hand the store proof to reportPurchase:
 *
 *   import { useIAP, requestPurchase, finishTransaction } from 'expo-iap';
 *
 *   const { products } = useIAP({
 *     onPurchaseSuccess: async (purchase) => {
 *       await InfluTo.reportPurchase({
 *         platform: Platform.OS,                                  // 'ios' | 'android'
 *         signedTransaction: Platform.OS === 'ios'
 *           ? (purchase as any).jwsRepresentationIos ?? purchase.purchaseToken  // SK2 JWS
 *           : undefined,
 *         purchaseToken: Platform.OS === 'android' ? purchase.purchaseToken : undefined,
 *       });
 *       await finishTransaction({ purchase, isConsumable: false });
 *     },
 *   });
 *   // requestPurchase({ request: { apple: { sku, appAccountToken }, google: { skus } }, type: 'subs' });
 *
 * Your InfluTo app must be configured for store-direct (ios_validation_provider=apple
 * / android_validation_provider=google) for /sdk/purchase to accept it.
 */
