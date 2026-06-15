# Promo Code Integration Guide

Complete guide for integrating manual promo code entry in your React Native app.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Headless Integration](#headless-integration-custom-ui)
- [Pre-built UI Component](#pre-built-ui-component)
- [Advanced Customization](#advanced-customization)
- [API Reference](#api-reference)

---

## Overview

InfluTo supports **two types of attribution**:

1. **Link-based attribution** (automatic) - User clicks influencer link → installs app
2. **Manual promo code entry** (this guide) - User types code in your app

Both methods work seamlessly with RevenueCat for commission tracking.

---

## Quick Start

### Option 1: Pre-built UI Component (2 lines of code)

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

function OnboardingScreen() {
  return (
    <ReferralCodeInput
      onValidated={(result) => {
        if (result.valid) {
          // Code is valid and automatically applied!
          navigation.navigate('Paywall');
        }
      }}
      onSkip={() => navigation.navigate('Paywall')}
    />
  );
}
```

### Option 2: Headless (Custom UI)

```typescript
import InfluTo from '@influto/react-native-sdk';
import { useState } from 'react';
import { TextInput, Button } from 'react-native';

function OnboardingScreen() {
  const [code, setCode] = useState('');

  const handleApply = async () => {
    const result = await InfluTo.applyCode(code);

    if (result.valid && result.applied) {
      // Success! Code is set in RevenueCat
      navigation.navigate('Paywall');
    } else {
      Alert.alert('Invalid Code', result.error);
    }
  };

  return (
    <>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Promo code"
        autoCapitalize="characters"
      />
      <Button title="Apply" onPress={handleApply} />
    </>
  );
}
```

---

## Headless Integration (Custom UI)

Build your own UI with full control over design and behavior.

### Basic Example

```typescript
import InfluTo from '@influto/react-native-sdk';
import { useState } from 'react';

function PromoCodeScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleValidate = async () => {
    setLoading(true);
    setMessage('');

    // Validate code
    const result = await InfluTo.validateCode(code);

    if (result.valid) {
      setMessage(`✓ ${result.message}`);

      // Apply code (sets in RevenueCat automatically)
      await InfluTo.setReferralCode(code);

      // Your custom logic
      navigation.navigate('Paywall', {
        campaign: result.campaign
      });
    } else {
      setMessage(`✗ ${result.error}`);
    }

    setLoading(false);
  };

  return (
    <View>
      <Text>Have a promo code?</Text>

      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="Enter code"
        autoCapitalize="characters"
        editable={!loading}
      />

      <Button
        title={loading ? 'Validating...' : 'Apply Code'}
        onPress={handleValidate}
        disabled={loading || !code}
      />

      {message && <Text>{message}</Text>}
    </View>
  );
}
```

### With Auto-Prefill

```typescript
function PromoCodeScreen() {
  const [code, setCode] = useState('');
  const [isPrefilled, setIsPrefilled] = useState(false);

  useEffect(() => {
    // Check if user came via attribution link
    async function loadPrefill() {
      const prefilledCode = await InfluTo.getPrefilledCode();

      if (prefilledCode) {
        setCode(prefilledCode);
        setIsPrefilled(true);
        // Optionally auto-validate
        await handleValidate(prefilledCode);
      }
    }

    loadPrefill();
  }, []);

  return (
    <View>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Promo code"
      />

      {isPrefilled && (
        <Text style={{color: 'green'}}>
          ✓ Code detected from your link
        </Text>
      )}

      <Button title="Apply" onPress={() => handleValidate(code)} />
    </View>
  );
}
```

### Conditional Offers Based on Campaign

```typescript
const handleApply = async () => {
  const result = await InfluTo.applyCode(code, userId);

  if (result.valid && result.applied) {
    // Different actions based on campaign
    if (result.campaign.commission_percentage >= 30) {
      // High-commission campaign → Premium offer
      navigation.navigate('PremiumTrialPaywall', {
        trialDays: 14,
        campaign: result.campaign
      });
    } else if (result.campaign.campaign_type === 'vip') {
      // VIP campaign → Special perks
      navigation.navigate('VIPPaywall');
    } else {
      // Standard campaign → Regular offer
      navigation.navigate('StandardPaywall');
    }
  }
};
```

---

## Pre-built UI Component

Use the ready-made component with full customization support.

### Basic Usage

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

### With Custom Colors

```typescript
<ReferralCodeInput
  colors={{
    primary: '#FF6B00',      // Your brand color
    success: '#10B981',      // Valid state
    error: '#EF4444',        // Error state
    text: '#1F2937',         // Main text
    textSecondary: '#6B7280' // Secondary text
  }}
  onValidated={(result) => {
    if (result.valid) {
      showPaywall(result.campaign);
    }
  }}
/>
```

### With Custom Labels (Internationalization)

```typescript
<ReferralCodeInput
  labels={{
    title: '¿Tienes un código promocional?',
    subtitle: 'Ingresa tu código para desbloquear ofertas especiales',
    placeholder: 'Ingresar código',
    validateButton: 'Aplicar Código',
    skipButton: 'Omitir',
    validMessage: '¡Código aplicado con éxito!',
    invalidMessage: 'Código inválido. Intenta de nuevo.'
  }}
  onValidated={(result) => {
    if (result.valid) {
      navigation.navigate('Paywall');
    }
  }}
/>
```

### With Custom Fonts

```typescript
<ReferralCodeInput
  fonts={{
    family: 'YourCustomFont-Regular',
    sizeTitle: 20,
    sizeInput: 18,
    sizeButton: 16,
    sizeMessage: 14
  }}
  onValidated={(result) => {
    if (result.valid) {
      navigation.navigate('Paywall');
    }
  }}
/>
```

### Full Customization Example

```typescript
<ReferralCodeInput
  // Behavior
  autoPrefill={true}
  autoValidate={false}
  showSkipButton={true}
  validateOnBlur={true}
  appUserId={user.id}

  // Callbacks
  onValidated={(result) => {
    if (result.valid) {
      console.log('Valid code:', result.code);
      console.log('Campaign:', result.campaign.name);
      console.log('Influencer:', result.influencer?.name);

      // Custom offer based on commission
      if (result.campaign.commission_percentage >= 30) {
        showPremiumOffer();
      } else {
        showStandardOffer();
      }
    } else {
      console.log('Invalid:', result.error);
      showError(result.error);
    }
  }}

  onApplied={(result) => {
    // Code was successfully set in RevenueCat
    console.log('Code applied in backend');
    analytics.track('promo_code_applied', { code: result.code });
  }}

  onSkip={() => {
    navigation.navigate('Paywall');
  }}

  // Styling
  colors={{
    primary: '#FF6B00',
    success: '#10B981',
    error: '#EF4444',
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#FFFFFF',
    border: '#D1D5DB',
    inputBackground: '#F9FAFB'
  }}

  fonts={{
    family: 'CustomFont-Regular',
    sizeTitle: 20,
    sizeInput: 18,
    sizeButton: 16,
    sizeMessage: 14
  }}

  labels={{
    title: 'Have a promo code?',
    subtitle: 'Unlock exclusive offers with an influencer code',
    placeholder: 'Enter code (e.g., FITGURU30)',
    validateButton: 'Apply & Continue',
    skipButton: 'No thanks',
    validatingMessage: 'Checking code...',
    validMessage: 'Code applied! Special offer unlocked.',
    invalidMessage: 'Code not found. Double-check and try again.',
    errorMessage: 'Unable to validate. Check your internet connection.',
    prefilledMessage: '✓ Code detected from your referral link'
  }}

  // Advanced styling
  style={{
    container: {
      padding: 24,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      margin: 16
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold'
    },
    input: {
      borderWidth: 2,
      borderRadius: 12,
      paddingHorizontal: 20
    },
    validateButton: {
      borderRadius: 12,
      paddingVertical: 16
    }
  }}
/>
```

---

## Advanced Customization

### Custom Validation Logic

```typescript
<ReferralCodeInput
  onValidated={(result) => {
    if (result.valid) {
      // Access all campaign data
      const campaign = result.campaign;
      const influencer = result.influencer;

      // Custom logic based on campaign
      if (campaign.custom_data?.trial_days) {
        showTrialOffer(campaign.custom_data.trial_days);
      } else if (campaign.custom_data?.discount_percentage) {
        showDiscountOffer(campaign.custom_data.discount_percentage);
      } else {
        showStandardOffer();
      }

      // Track in your analytics
      analytics.track('promo_code_valid', {
        code: result.code,
        campaign: campaign.name,
        commission: campaign.commission_percentage
      });
    } else {
      // Handle invalid code
      if (result.error_code === 'CODE_NOT_FOUND') {
        showCustomError('Code not found. Check with your influencer.');
      } else if (result.error_code === 'INVALID_FORMAT') {
        showCustomError('Please enter a valid format (4-20 characters)');
      }
    }
  }}
/>
```

### Integration with Onboarding Flow

```typescript
function OnboardingFlow() {
  const [step, setStep] = useState(1);

  return (
    <View>
      {step === 1 && <WelcomeScreen onNext={() => setStep(2)} />}

      {step === 2 && (
        <ReferralCodeInput
          autoPrefill={true}
          onValidated={(result) => {
            if (result.valid) {
              // Store for later use
              setUserContext({ hasPromoCode: true, campaign: result.campaign });
              setStep(3); // Continue onboarding
            }
          }}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && <PaywallScreen />}
    </View>
  );
}
```

### Integration with Profile/Settings

```typescript
function SettingsScreen() {
  const [showPromoInput, setShowPromoInput] = useState(false);

  return (
    <ScrollView>
      <Text>Account Settings</Text>

      <TouchableOpacity onPress={() => setShowPromoInput(true)}>
        <Text>+ Add Promo Code</Text>
      </TouchableOpacity>

      {showPromoInput && (
        <ReferralCodeInput
          autoPrefill={false} // Don't prefill in settings
          showSkipButton={false} // No skip in settings
          appUserId={user.id}
          onValidated={(result) => {
            if (result.valid) {
              Alert.alert('Success', 'Promo code applied to your account!');
              setShowPromoInput(false);
            }
          }}
          labels={{
            title: 'Add Promo Code',
            subtitle: 'Apply an influencer code to support them',
            validateButton: 'Add to Account'
          }}
        />
      )}
    </ScrollView>
  );
}
```

---

## API Reference

### SDK Methods

#### `InfluTo.validateCode(code: string)`

Validate a code without applying it.

```typescript
const result = await InfluTo.validateCode('FITGURU30');

// result = {
//   valid: true,
//   code: 'FITGURU30',
//   campaign: {
//     id: '123',
//     name: 'Fitness Influencer Program',
//     commission_percentage: 30
//   },
//   influencer: {
//     name: 'John Doe',
//     social_handle: '@fitguru'
//   },
//   message: 'Valid code! Referred by John Doe'
// }
```

**Returns:** `Promise<CodeValidationResult>`

---

#### `InfluTo.setReferralCode(code: string, appUserId?: string)`

Apply a code (sets in RevenueCat automatically).

```typescript
const result = await InfluTo.setReferralCode('FITGURU30', userId);

// result = {
//   success: true,
//   code: 'FITGURU30',
//   message: 'Referral code set successfully',
//   campaign: { id: '123', name: 'Fitness Program' }
// }
```

**What it does:**
1. Stores code locally (AsyncStorage)
2. Sets in RevenueCat attributes automatically
3. Records attribution with backend
4. Future webhooks will attribute to this code

**Returns:** `Promise<SetCodeResult>`

---

#### `InfluTo.applyCode(code: string, appUserId?: string)`

Validate and apply in one step (convenience method).

```typescript
const result = await InfluTo.applyCode('FITGURU30', userId);

if (result.valid && result.applied) {
  console.log('Code validated AND applied!');
  showPaywall(result.campaign);
}
```

**Returns:** `Promise<CodeValidationResult & { applied: boolean }>`

---

#### `InfluTo.getPrefilledCode()`

Get code if user came via attribution link (for auto-prefill).

```typescript
const prefilledCode = await InfluTo.getPrefilledCode();

if (prefilledCode) {
  setInputValue(prefilledCode);
  // Optionally auto-validate
  await InfluTo.validateCode(prefilledCode);
}
```

**Returns:** `Promise<string | null>`

---

### UI Component Props

#### `ReferralCodeInputProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoPrefill` | `boolean` | `true` | Auto-fill if user came via link |
| `autoValidate` | `boolean` | `false` | Auto-validate prefilled code |
| `onValidated` | `(result) => void` | - | Called when code validated |
| `onApplied` | `(result) => void` | - | Called when code applied |
| `onSkip` | `() => void` | - | Called when user skips |
| `appUserId` | `string` | - | User ID for tracking |
| `colors` | `object` | - | Custom color scheme |
| `fonts` | `object` | - | Custom fonts |
| `labels` | `object` | - | Custom text labels |
| `style` | `object` | - | Custom styles |
| `showSkipButton` | `boolean` | `true` | Show skip button |
| `validateOnBlur` | `boolean` | `true` | Validate when input loses focus |

---

## Complete Examples

### Example 1: Minimal Integration

```typescript
import { ReferralCodeInput } from '@influto/react-native-sdk/ui';

<ReferralCodeInput
  onValidated={(result) => {
    if (result.valid) {
      navigation.navigate('Paywall');
    }
  }}
/>
```

### Example 2: Onboarding with Conditional Offers

```typescript
<ReferralCodeInput
  autoPrefill={true}
  onValidated={(result) => {
    if (result.valid) {
      // Different paywall based on commission tier
      const commission = result.campaign.commission_percentage;

      if (commission >= 40) {
        navigation.navigate('VIPPaywall', { trialDays: 30 });
      } else if (commission >= 30) {
        navigation.navigate('PremiumPaywall', { trialDays: 14 });
      } else {
        navigation.navigate('StandardPaywall', { trialDays: 7 });
      }
    }
  }}
  onSkip={() => navigation.navigate('StandardPaywall')}
/>
```

### Example 3: Full Custom Styling

```typescript
<ReferralCodeInput
  colors={{
    primary: '#8B5CF6',       // Purple
    success: '#059669',       // Emerald
    error: '#DC2626',         // Red
    text: '#111827',          // Gray-900
    textSecondary: '#9CA3AF', // Gray-400
    background: '#FFFFFF',
    border: '#E5E7EB',
    inputBackground: '#F3F4F6'
  }}

  fonts={{
    family: 'Poppins-Regular',
    sizeTitle: 22,
    sizeInput: 18,
    sizeButton: 17,
    sizeMessage: 15
  }}

  labels={{
    title: 'Unlock Your Special Offer',
    subtitle: 'Enter the code shared by your favorite influencer',
    placeholder: 'INFLUENCER CODE',
    validateButton: 'Unlock Offer',
    skipButton: 'Continue Without Code',
    validMessage: '🎉 Special offer activated!',
    invalidMessage: 'Hmm, that code isn\'t valid. Double-check it?'
  }}

  style={{
    container: {
      padding: 24,
      marginHorizontal: 20,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8
    },
    input: {
      height: 56,
      borderWidth: 2.5,
      borderRadius: 14,
      paddingHorizontal: 20,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: 2
    },
    validateButton: {
      height: 56,
      borderRadius: 14,
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8
    }
  }}

  onValidated={(result) => {
    if (result.valid) {
      navigation.navigate('PaywallScreen', { campaign: result.campaign });
    }
  }}
/>
```

### Example 4: Headless with Validation-Only

```typescript
// Validate without applying (for preview)
const [validationState, setValidationState] = useState(null);

const checkCode = async () => {
  const result = await InfluTo.validateCode(inputCode);

  if (result.valid) {
    // Show preview of offer
    setValidationState({
      valid: true,
      campaign: result.campaign,
      influencer: result.influencer
    });

    // Let user decide if they want to apply
    Alert.alert(
      'Valid Code!',
      `Campaign: ${result.campaign.name}\nInfluencer: ${result.influencer?.name}\n\nApply this code?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            await InfluTo.setReferralCode(inputCode);
            navigation.navigate('Paywall');
          }
        }
      ]
    );
  } else {
    Alert.alert('Invalid Code', result.error);
  }
};
```

---

## Integration Patterns

### Pattern 1: Onboarding Screen

**When to use:** First-time user experience

```typescript
function OnboardingScreen3() {
  return (
    <View>
      <Text>Welcome! Let's get you started.</Text>

      <ReferralCodeInput
        autoPrefill={true}
        onValidated={(result) => {
          if (result.valid) {
            navigation.navigate('SetupProfile');
          }
        }}
        onSkip={() => navigation.navigate('SetupProfile')}
      />
    </View>
  );
}
```

### Pattern 2: Paywall Screen

**When to use:** Before showing subscription options

```typescript
function PaywallScreen() {
  const [codeApplied, setCodeApplied] = useState(false);

  return (
    <View>
      {!codeApplied && (
        <ReferralCodeInput
          showSkipButton={false}
          onValidated={(result) => {
            if (result.valid) {
              setCodeApplied(true);
              // Modify paywall based on code
            }
          }}
        />
      )}

      <SubscriptionOptions hasPromoCode={codeApplied} />
    </View>
  );
}
```

### Pattern 3: Settings/Profile

**When to use:** Let user add code after signup

```typescript
function ProfileScreen() {
  return (
    <ScrollView>
      <SettingItem
        title="Referral Code"
        onPress={() => {
          // Show modal with code input
          showModal(
            <ReferralCodeInput
              autoPrefill={false}
              appUserId={user.id}
              onValidated={(result) => {
                if (result.valid) {
                  closeModal();
                  showSuccess('Code added to your account!');
                }
              }}
            />
          );
        }}
      />
    </ScrollView>
  );
}
```

---

## Best Practices

### 1. **Always set in RevenueCat**

```typescript
// ✅ GOOD - SDK does this automatically
await InfluTo.applyCode(code, userId);

// ❌ DON'T manually set without InfluTo
await Purchases.setAttributes({ influto_code: code }); // Missing backend tracking!
```

### 2. **Validate before showing custom offers**

```typescript
// ✅ GOOD
const result = await InfluTo.validateCode(code);
if (result.valid) {
  showOffer(result.campaign);
}

// ❌ DON'T show offers without validation
showOffer(); // User could enter any random code
```

### 3. **Handle all states**

```typescript
// ✅ GOOD
onValidated={(result) => {
  if (result.valid) {
    // Success path
  } else if (result.error_code === 'CODE_NOT_FOUND') {
    // Invalid code
  } else if (result.error_code === 'NETWORK_ERROR') {
    // Network issue - allow retry
  }
}}

// ❌ DON'T ignore errors
onValidated={(result) => {
  if (result.valid) {
    // Only handle success
  }
  // Errors ignored - bad UX!
}}
```

### 4. **Auto-prefill when possible**

```typescript
// ✅ GOOD - Better UX
<ReferralCodeInput autoPrefill={true} />

// ❌ DON'T force user to re-enter code they already clicked
<ReferralCodeInput autoPrefill={false} />
```

---

## Testing

### Test Manual Entry

```typescript
// 1. Get a valid code from your dashboard
const testCode = 'FITGURU30';

// 2. Test validation
const result = await InfluTo.validateCode(testCode);
console.log('Valid:', result.valid);

// 3. Test application
const setResult = await InfluTo.setReferralCode(testCode);
console.log('Applied:', setResult.success);

// 4. Verify in RevenueCat
const customerInfo = await Purchases.getCustomerInfo();
console.log('Attributes:', customerInfo.entitlements.all);
// Should see: influto_code = 'FITGURU30'
```

### Test Auto-Prefill

```typescript
// 1. Visit referral link in browser: https://influ.to/yourapp/FITGURU30
// 2. Open your app
// 3. Component should auto-prefill with 'FITGURU30'

useEffect(() => {
  async function test() {
    const prefilled = await InfluTo.getPrefilledCode();
    console.log('Prefilled code:', prefilled); // Should be 'FITGURU30'
  }
  test();
}, []);
```

---

## Troubleshooting

**Code not validating?**
- Check API key is correct
- Verify code exists in your dashboard
- Ensure campaign is active
- Check network connectivity

**Code not prefilling?**
- User must click influencer link BEFORE installing app
- Attribution window is 72 hours (default)
- Check `InfluTo.checkAttribution()` was called

**RevenueCat not receiving code?**
- Ensure you're using `InfluTo.setReferralCode()` or `InfluTo.applyCode()`
- Check RevenueCat is initialized before InfluTo
- Verify `Purchases.setAttributes()` is available

---

## Support

- **Documentation:** https://docs.influ.to
- **Help Center:** https://influ.to/help
- **Email:** hello@influ.to
