# InfluTo SDK - Complete Examples

Real-world integration examples for common use cases.

## Table of Contents

- [Basic Attribution](#basic-attribution)
- [Promo Code - Pre-built UI](#promo-code---pre-built-ui)
- [Promo Code - Custom UI](#promo-code---custom-ui)
- [Integration with RevenueCat](#integration-with-revenuecat)
- [Onboarding Flow](#onboarding-flow)
- [Settings/Profile](#settingsprofile)

---

## Basic Attribution

### Automatic Link Attribution

```typescript
import React, { useEffect } from 'react';
import InfluTo from '@influto/react-native-sdk';
import Purchases from 'react-native-purchases';

function App() {
  useEffect(() => {
    async function setup() {
      // 1. Initialize RevenueCat first
      Purchases.configure({
        apiKey: 'rcpk_...'
      });

      // 2. Initialize InfluTo
      await InfluTo.initialize({
        apiKey: 'it_abc123...',
        debug: __DEV__
      });

      // 3. Check attribution (SDK sets RevenueCat attribute automatically)
      const attribution = await InfluTo.checkAttribution();

      if (attribution.attributed) {
        console.log('✅ User came from:', attribution.referralCode);
        // Referral code is already in RevenueCat - nothing else needed!
      }
    }

    setup();
  }, []);

  return <YourApp />;
}
```

---

## Promo Code - Pre-built UI

### Example 1: Simple Onboarding

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>

      {/* Simple 2-line integration */}
      <ReferralCodeInput
        onValidated={(result) => {
          if (result.valid) {
            navigation.navigate('Paywall');
          }
        }}
        onSkip={() => navigation.navigate('Paywall')}
      />
    </View>
  );
}
```

### Example 2: Branded Styling

```typescript
<ReferralCodeInput
  // Match your app's design
  colors={{
    primary: '#FF6B00',      // Your brand orange
    success: '#10B981',
    error: '#EF4444',
    text: '#1F2937',
    background: '#FFFFFF'
  }}

  fonts={{
    family: 'YourApp-Bold',  // Your app font
    sizeTitle: 22,
    sizeInput: 18
  }}

  labels={{
    title: 'Got a Referral Code?',
    subtitle: 'Enter it to support your favorite creator',
    validateButton: 'Apply Code',
    skipButton: 'Maybe Later'
  }}

  onValidated={(result) => {
    if (result.valid) {
      // Show branded success message
      Toast.show({
        type: 'success',
        text1: 'Code Applied!',
        text2: `Thanks for supporting ${result.influencer?.name}!`
      });

      navigation.navigate('Paywall');
    }
  }}
/>
```

### Example 3: Multi-Step Onboarding

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [promoCode, setPromoCode] = useState(null);

  return (
    <View>
      {step === 1 && (
        <WelcomeScreen onContinue={() => setStep(2)} />
      )}

      {step === 2 && (
        <GoalsScreen onContinue={() => setStep(3)} />
      )}

      {step === 3 && (
        <View>
          <Text>Almost done!</Text>

          <ReferralCodeInput
            autoPrefill={true}
            autoValidate={true}  // Auto-validate prefilled codes
            onValidated={(result) => {
              if (result.valid) {
                setPromoCode(result);
                setStep(4); // Continue to paywall
              }
            }}
            onSkip={() => setStep(4)}
            labels={{
              title: 'One Last Thing...',
              subtitle: 'Got a code from a friend?'
            }}
          />
        </View>
      )}

      {step === 4 && (
        <PaywallScreen
          hasPromoCode={!!promoCode}
          campaign={promoCode?.campaign}
        />
      )}
    </View>
  );
}
```

---

## Promo Code - Custom UI

### Example 1: Minimal Custom Input

```typescript
import InfluTo from '@influto/react-native-sdk';
import { useState } from 'react';

function CustomPromoInput() {
  const [code, setCode] = useState('');
  const [state, setState] = useState('idle'); // idle, validating, valid, invalid

  const handleApply = async () => {
    setState('validating');

    const result = await InfluTo.applyCode(code);

    if (result.valid && result.applied) {
      setState('valid');
      navigation.navigate('Paywall');
    } else {
      setState('invalid');
      Alert.alert('Invalid Code', result.error);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="Promo code"
        autoCapitalize="characters"
        style={[
          styles.input,
          state === 'valid' && styles.inputValid,
          state === 'invalid' && styles.inputInvalid
        ]}
      />

      <TouchableOpacity
        onPress={handleApply}
        disabled={state === 'validating' || !code}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {state === 'validating' ? 'Checking...' : 'Apply Code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Example 2: With Auto-Prefill

```typescript
function SmartPromoInput() {
  const [code, setCode] = useState('');
  const [isPrefilled, setIsPrefilled] = useState(false);

  useEffect(() => {
    // Check for prefilled code on mount
    async function loadCode() {
      const prefilled = await InfluTo.getPrefilledCode();

      if (prefilled) {
        setCode(prefilled);
        setIsPrefilled(true);
        // Show user the code was detected
        Toast.show('Referral code detected!');
      }
    }

    loadCode();
  }, []);

  const handleSubmit = async () => {
    const result = await InfluTo.applyCode(code);

    if (result.valid) {
      navigation.navigate('Paywall', { campaign: result.campaign });
    }
  };

  return (
    <View>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Enter promo code"
      />

      {isPrefilled && (
        <Text style={styles.prefilledBadge}>
          ✓ Code from your referral link
        </Text>
      )}

      <Button title="Continue" onPress={handleSubmit} />
    </View>
  );
}
```

### Example 3: Validation with Campaign Info

```typescript
function DetailedPromoInput() {
  const [code, setCode] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const handleValidate = async () => {
    // Validate first (without applying)
    const result = await InfluTo.validateCode(code);
    setValidationResult(result);

    if (result.valid) {
      // Show campaign details before applying
      Alert.alert(
        'Valid Code!',
        `Campaign: ${result.campaign.name}\n` +
        `Influencer: ${result.influencer?.name || 'Unknown'}\n` +
        `Commission: ${result.campaign.commission_percentage}%\n\n` +
        'Apply this code?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Apply',
            onPress: async () => {
              await InfluTo.setReferralCode(code);
              navigation.navigate('Paywall');
            }
          }
        ]
      );
    }
  };

  return (
    <View>
      <TextInput
        value={code}
        onChangeText={setCode}
        onBlur={handleValidate}  // Validate on blur
      />

      {validationResult?.valid && (
        <View style={styles.campaignPreview}>
          <Text>{validationResult.campaign.name}</Text>
          <Text>{validationResult.campaign.description}</Text>
          <Text>Referred by {validationResult.influencer?.name}</Text>
        </View>
      )}
    </View>
  );
}
```

---

## Integration with RevenueCat

### Complete Flow with Promo Codes

```typescript
import InfluTo from '@influto/react-native-sdk';
import Purchases from 'react-native-purchases';

function CompleteIntegration() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function setup() {
      // 1. Initialize RevenueCat
      Purchases.configure({ apiKey: 'rcpk_...' });

      // 2. Get RevenueCat user ID
      const customerInfo = await Purchases.getCustomerInfo();
      const appUserId = customerInfo.originalAppUserId;
      setUserId(appUserId);

      // 3. Initialize InfluTo
      await InfluTo.initialize({
        apiKey: 'it_abc123...',
        debug: __DEV__
      });

      // 4. Check auto-attribution (link-based)
      const attribution = await InfluTo.checkAttribution();

      if (attribution.attributed) {
        console.log('Auto-attributed:', attribution.referralCode);
        // RevenueCat attribute already set by SDK!
      }

      // 5. Identify user
      await InfluTo.identifyUser(appUserId);
    }

    setup();
  }, []);

  const handleManualCode = async (code) => {
    // User types code manually
    const result = await InfluTo.applyCode(code, userId);

    if (result.valid && result.applied) {
      // Code is now in RevenueCat attributes
      // Future purchases will be attributed to this code
      showPaywall();
    }
  };

  return <YourApp onEnterCode={handleManualCode} />;
}
```

### Verify Code in RevenueCat

```typescript
// After applying code, verify it's in RevenueCat
const customerInfo = await Purchases.getCustomerInfo();
const referralCode = customerInfo.allPurchasedProductIdentifiers
  .map(id => customerInfo.entitlements.all[id])
  .find(e => e?.productIdentifier)?.influto_code;

console.log('Referral code in RevenueCat:', referralCode);
// Should match the code user entered
```

---

## Onboarding Flow

### Complete Onboarding Example

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';
import InfluTo from '@influto/react-native-sdk';
import Purchases from 'react-native-purchases';

function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userData, setUserData] = useState({});

  useEffect(() => {
    // Initialize SDK on mount
    async function init() {
      await Purchases.configure({ apiKey: 'rcpk_...' });
      await InfluTo.initialize({ apiKey: 'it_...' });

      // Auto-check attribution
      const attribution = await InfluTo.checkAttribution();
      if (attribution.attributed) {
        setUserData({ hasReferral: true, code: attribution.referralCode });
      }
    }
    init();
  }, []);

  return (
    <View>
      {/* Step 1: Welcome */}
      {currentStep === 1 && (
        <View>
          <Text>Welcome to FitApp!</Text>
          <Button title="Get Started" onPress={() => setCurrentStep(2)} />
        </View>
      )}

      {/* Step 2: Goals */}
      {currentStep === 2 && (
        <View>
          <Text>What are your fitness goals?</Text>
          <GoalSelector onComplete={() => setCurrentStep(3)} />
        </View>
      )}

      {/* Step 3: Promo Code (Optional) */}
      {currentStep === 3 && (
        <View>
          <ReferralCodeInput
            autoPrefill={true}  // Pre-fills if from link
            onValidated={(result) => {
              if (result.valid) {
                setUserData({ ...userData, campaign: result.campaign });
                setCurrentStep(4);
              }
            }}
            onSkip={() => setCurrentStep(4)}
            labels={{
              title: 'Have a referral code?',
              subtitle: 'Enter it to unlock a special trial offer'
            }}
          />
        </View>
      )}

      {/* Step 4: Paywall */}
      {currentStep === 4 && (
        <PaywallScreen
          userData={userData}
          showTrial={!!userData.campaign}
        />
      )}
    </View>
  );
}
```

---

## Settings/Profile

### Add Code After Signup

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

function ProfileScreen() {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [appliedCode, setAppliedCode] = useState(null);

  useEffect(() => {
    // Check if user already has a code
    async function loadCode() {
      const code = await InfluTo.getReferralCode();
      setAppliedCode(code);
    }
    loadCode();
  }, []);

  return (
    <ScrollView>
      <Text>Profile Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referral Code</Text>

        {appliedCode ? (
          <View>
            <Text style={styles.appliedCode}>✓ {appliedCode}</Text>
            <Text style={styles.appliedMessage}>
              Supporting your favorite influencer!
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowCodeInput(true)}
            style={styles.addCodeButton}
          >
            <Text>+ Add Referral Code</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal for code input */}
      <Modal visible={showCodeInput} animationType="slide">
        <View style={styles.modal}>
          <ReferralCodeInput
            autoPrefill={false}  // Don't prefill in settings
            showSkipButton={false}  // No skip in settings
            appUserId={user.id}

            onValidated={(result) => {
              if (result.valid) {
                setAppliedCode(result.code);
                setShowCodeInput(false);
                Toast.show('Referral code added!');
              }
            }}

            labels={{
              title: 'Add Referral Code',
              subtitle: 'Support an influencer by adding their code',
              validateButton: 'Add to Profile'
            }}
          />

          <Button title="Cancel" onPress={() => setShowCodeInput(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}
```

---

## Advanced Use Cases

### Example: Conditional Paywall Based on Code

```typescript
function SmartPaywall() {
  const [offer, setOffer] = useState('standard');

  const handleCodeApplied = async (result) => {
    if (!result.valid) return;

    // Determine offer based on campaign
    const commission = result.campaign.commission_percentage;
    const campaignType = result.campaign.campaign_type;

    if (campaignType === 'vip' || commission >= 40) {
      setOffer('premium'); // 30-day trial
    } else if (commission >= 30) {
      setOffer('standard'); // 14-day trial
    } else {
      setOffer('basic'); // 7-day trial
    }

    // Track for analytics
    analytics.track('promo_code_applied', {
      code: result.code,
      campaign: result.campaign.name,
      offer_type: offer
    });
  };

  return (
    <View>
      {/* Code input */}
      <ReferralCodeInput
        onValidated={handleCodeApplied}
        onSkip={() => setOffer('standard')}
      />

      {/* Dynamic paywall based on code */}
      {offer === 'premium' && (
        <PremiumPaywall trialDays={30} />
      )}

      {offer === 'standard' && (
        <StandardPaywall trialDays={14} />
      )}

      {offer === 'basic' && (
        <BasicPaywall trialDays={7} />
      )}
    </View>
  );
}
```

### Example: Headless with Real-Time Validation

```typescript
function RealtimeValidation() {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);

  // Debounced validation
  useEffect(() => {
    if (code.length >= 4) {
      const timer = setTimeout(async () => {
        setValidating(true);
        const validationResult = await InfluTo.validateCode(code);
        setResult(validationResult);
        setValidating(false);
      }, 500); // Wait 500ms after user stops typing

      return () => clearTimeout(timer);
    } else {
      setResult(null);
    }
  }, [code]);

  return (
    <View>
      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="Enter code"
      />

      {/* Real-time feedback */}
      {validating && <Text>Checking...</Text>}

      {result?.valid && (
        <View style={styles.validBadge}>
          <Text>✓ Valid code!</Text>
          <Text>{result.campaign.name}</Text>
          <Text>by {result.influencer?.name}</Text>
        </View>
      )}

      {result && !result.valid && (
        <Text style={styles.error}>✗ {result.error}</Text>
      )}

      <Button
        title="Continue"
        disabled={!result?.valid}
        onPress={async () => {
          await InfluTo.setReferralCode(code);
          navigation.navigate('Paywall');
        }}
      />
    </View>
  );
}
```

### Example: Multiple Codes (Stacking)

```typescript
// If you want to allow multiple referral codes (e.g., first-time + influencer)
function MultiCodeInput() {
  const [codes, setCodes] = useState([]);

  const handleAddCode = async (newCode) => {
    const result = await InfluTo.validateCode(newCode);

    if (result.valid) {
      setCodes([...codes, result]);

      // Set the most recent code in RevenueCat
      await InfluTo.setReferralCode(newCode);

      Alert.alert('Code Added', `You now have ${codes.length + 1} active codes!`);
    }
  };

  return (
    <View>
      {codes.map((code, index) => (
        <View key={index} style={styles.appliedCode}>
          <Text>{code.code} - {code.campaign.name}</Text>
        </View>
      ))}

      <ReferralCodeInput
        onValidated={(result) => {
          if (result.valid) {
            handleAddCode(result.code);
          }
        }}
      />
    </View>
  );
}
```

---

## Complete App Example

### Full Production-Ready Implementation

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import InfluTo from '@influto/react-native-sdk';
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';
import Purchases from 'react-native-purchases';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [userId, setUserId] = useState(null);
  const [hasPromoCode, setHasPromoCode] = useState(false);

  // Initialize on mount
  useEffect(() => {
    async function initializeSDKs() {
      try {
        // 1. RevenueCat
        Purchases.configure({
          apiKey: Platform.OS === 'ios' ? 'rcpk_ios_...' : 'rcpk_android_...'
        });

        const customerInfo = await Purchases.getCustomerInfo();
        setUserId(customerInfo.originalAppUserId);

        // 2. InfluTo
        await InfluTo.initialize({
          apiKey: 'it_abc123...',
          debug: __DEV__
        });

        // 3. Auto-attribution check
        const attribution = await InfluTo.checkAttribution();
        if (attribution.attributed) {
          setHasPromoCode(true);
        }

        // 4. Identify user
        await InfluTo.identifyUser(customerInfo.originalAppUserId);

        setInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
      }
    }

    initializeSDKs();
  }, []);

  if (!initialized) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="PromoCode" component={PromoCodeScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function OnboardingScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to FitApp!</Text>

      {/* Step through onboarding */}
      <Button
        title="Continue"
        onPress={() => navigation.navigate('PromoCode')}
      />
    </View>
  );
}

function PromoCodeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <ReferralCodeInput
        // Auto-prefill if user clicked link
        autoPrefill={true}
        autoValidate={true}

        // Brand colors
        colors={{
          primary: '#FF6B00',
          success: '#10B981',
          error: '#EF4444'
        }}

        // Callbacks
        onValidated={(result) => {
          if (result.valid) {
            // Navigate based on campaign
            navigation.navigate('Paywall', {
              trialDays: result.campaign.commission_percentage >= 30 ? 14 : 7,
              campaign: result.campaign
            });
          }
        }}

        onSkip={() => {
          navigation.navigate('Paywall', { trialDays: 7 });
        }}
      />
    </View>
  );
}

function PaywallScreen({ route }) {
  const { trialDays = 7, campaign } = route.params || {};

  const handlePurchase = async () => {
    try {
      // Present paywall
      const purchaseResult = await Purchases.purchasePackage(package);

      if (purchaseResult.customerInfo.entitlements.active.pro) {
        // Purchase successful!
        // InfluTo webhook will automatically track this
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error('Purchase error:', error);
    }
  };

  return (
    <View>
      {campaign && (
        <View style={styles.campaignBadge}>
          <Text>Special Offer: {campaign.name}</Text>
        </View>
      )}

      <Text>Start your {trialDays}-day free trial</Text>

      <Button title="Start Trial" onPress={handlePurchase} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20
  },
  campaignBadge: {
    padding: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    marginBottom: 16
  }
});
```

---

## Testing Guide

### Test Scenario 1: Link Attribution + Manual Entry

```typescript
// 1. Click link: https://influ.to/yourapp/FITGURU30
// 2. Install app
// 3. Open app
const attribution = await InfluTo.checkAttribution();
// Expected: { attributed: true, referralCode: 'FITGURU30' }

// 4. Show promo input (should auto-prefill)
const prefilled = await InfluTo.getPrefilledCode();
// Expected: 'FITGURU30'
```

### Test Scenario 2: Manual Entry Only

```typescript
// 1. Install app (no link click)
// 2. Open app
const attribution = await InfluTo.checkAttribution();
// Expected: { attributed: false }

// 3. User types code manually
const result = await InfluTo.applyCode('FITGURU30');
// Expected: { valid: true, applied: true, code: 'FITGURU30' }

// 4. Verify in RevenueCat
const customerInfo = await Purchases.getCustomerInfo();
// Should have influto_code attribute set
```

### Test Scenario 3: Invalid Code

```typescript
const result = await InfluTo.validateCode('INVALID123');
// Expected: {
//   valid: false,
//   error: 'Code not found or inactive',
//   error_code: 'CODE_NOT_FOUND'
// }
```

---

## Migration from v1.0.0

### Before (v1.0.0)

```typescript
// Only supported link-based attribution
const attribution = await InfluTo.checkAttribution();
// Manual codes not supported ❌
```

### After (v1.1.0)

```typescript
// Still supports link attribution
const attribution = await InfluTo.checkAttribution();

// NEW: Manual code entry
const result = await InfluTo.applyCode('FITGURU30');

// NEW: Pre-built UI
<ReferralCodeInput onValidated={...} />
```

**All existing code continues to work!** No breaking changes.

---

## Best Practices

1. **Always initialize before using promo features**
   ```typescript
   await InfluTo.initialize({ apiKey: '...' });
   ```

2. **Use `applyCode()` for simplicity**
   ```typescript
   // ✅ GOOD - Validates and applies in one call
   await InfluTo.applyCode(code);

   // ❌ Avoid - Two separate calls
   await InfluTo.validateCode(code);
   await InfluTo.setReferralCode(code);
   ```

3. **Handle all states in UI**
   ```typescript
   onValidated={(result) => {
     if (result.valid) {
       // Success
     } else if (result.error_code === 'CODE_NOT_FOUND') {
       // Invalid code
     } else if (result.error_code === 'NETWORK_ERROR') {
       // Network issue
     }
   }}
   ```

4. **Auto-prefill when possible**
   ```typescript
   <ReferralCodeInput autoPrefill={true} />
   // Better UX than making user re-enter clicked code
   ```

5. **Track in your analytics**
   ```typescript
   onValidated={(result) => {
     if (result.valid) {
       analytics.track('promo_code_valid', {
         code: result.code,
         campaign: result.campaign.name,
         source: 'onboarding'
       });
     }
   }}
   ```

---

## Support

Need help integrating promo codes?

- **Help Center:** https://influ.to/help
- **Email:** hello@influ.to
- **Documentation:** https://docs.influ.to
