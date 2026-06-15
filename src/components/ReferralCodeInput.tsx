/**
 * ReferralCodeInput - Pre-built UI component for promo code entry
 *
 * Features:
 * - Auto-prefills if user came via attribution link
 * - Real-time validation
 * - Customizable styling (colors, fonts, spacing)
 * - Loading & success/error states
 * - Optional skip button
 * - Callback on validation
 * - Fully accessible
 *
 * @example
 * ```typescript
 * import { ReferralCodeInput } from '@influto/react-native-sdk/ui';
 *
 * <ReferralCodeInput
 *   onValidated={(result) => {
 *     if (result.valid) {
 *       navigation.navigate('Paywall', { campaign: result.campaign });
 *     }
 *   }}
 *   onSkip={() => navigation.navigate('Paywall')}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform
} from 'react-native';
import InfluTo from '../InfluTo';
import type { CodeValidationResult } from '../types';

export interface ReferralCodeInputProps {
  /**
   * Auto-prefill code if user came via attribution link
   * @default true
   */
  autoPrefill?: boolean;

  /**
   * Auto-validate code on mount (if prefilled)
   * @default false
   */
  autoValidate?: boolean;

  /**
   * Callback when code is validated (valid or invalid)
   */
  onValidated?: (result: CodeValidationResult) => void;

  /**
   * Callback when user skips code entry
   */
  onSkip?: () => void;

  /**
   * Callback when code is successfully applied
   */
  onApplied?: (result: CodeValidationResult) => void;

  /**
   * App user ID (if available) - used for attribution tracking
   */
  appUserId?: string;

  /**
   * Custom color scheme
   */
  colors?: {
    primary?: string;
    success?: string;
    error?: string;
    text?: string;
    textSecondary?: string;
    background?: string;
    border?: string;
    inputBackground?: string;
  };

  /**
   * Custom fonts
   */
  fonts?: {
    family?: string;
    sizeTitle?: number;
    sizeInput?: number;
    sizeButton?: number;
    sizeMessage?: number;
  };

  /**
   * Custom text labels (for internationalization)
   */
  labels?: {
    title?: string;
    subtitle?: string;
    placeholder?: string;
    validateButton?: string;
    skipButton?: string;
    validatingMessage?: string;
    validMessage?: string;
    invalidMessage?: string;
    errorMessage?: string;
    prefilledMessage?: string;
  };

  /**
   * Custom styles for fine-grained control
   */
  style?: {
    container?: ViewStyle;
    titleContainer?: ViewStyle;
    title?: TextStyle;
    subtitle?: TextStyle;
    inputContainer?: ViewStyle;
    input?: TextStyle;
    buttonContainer?: ViewStyle;
    validateButton?: ViewStyle;
    validateButtonText?: TextStyle;
    skipButton?: ViewStyle;
    skipButtonText?: TextStyle;
    messageContainer?: ViewStyle;
    messageText?: TextStyle;
  };

  /**
   * Show skip button
   * @default true
   */
  showSkipButton?: boolean;

  /**
   * Validate on blur (when user leaves input)
   * @default true
   */
  validateOnBlur?: boolean;

  /**
   * Show the campaign name when a code is valid.
   *
   * Defaults to `false`: the component shows only the field + a valid/invalid state
   * (consistent with the other InfluTo SDKs). Set to `true` to surface `campaign.name`.
   * @default false
   */
  showCampaignName?: boolean;

  /**
   * Show "Referred by <influencer name>" when a code is valid.
   *
   * Defaults to `false` (the influencer's personal name is not disclosed to end users).
   * Set to `true` only if your influencers have consented to showing their name.
   * @default false
   */
  showReferrerName?: boolean;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'error';

export const ReferralCodeInput: React.FC<ReferralCodeInputProps> = ({
  autoPrefill = true,
  autoValidate = false,
  onValidated,
  onSkip,
  onApplied,
  appUserId,
  colors = {},
  fonts = {},
  labels = {},
  style = {},
  showSkipButton = true,
  validateOnBlur = true,
  showCampaignName = false,
  showReferrerName = false
}) => {
  const [code, setCode] = useState('');
  const [state, setState] = useState<ValidationState>('idle');
  const [validationResult, setValidationResult] = useState<CodeValidationResult | null>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);

  // Default colors
  const colorScheme = {
    primary: colors.primary || '#3B82F6',
    success: colors.success || '#10B981',
    error: colors.error || '#EF4444',
    text: colors.text || '#1F2937',
    textSecondary: colors.textSecondary || '#6B7280',
    background: colors.background || '#FFFFFF',
    border: colors.border || '#D1D5DB',
    inputBackground: colors.inputBackground || '#F9FAFB'
  };

  // Default fonts
  const fontScheme = {
    family: fonts.family || (Platform.OS === 'ios' ? 'System' : 'Roboto'),
    sizeTitle: fonts.sizeTitle || 18,
    sizeInput: fonts.sizeInput || 16,
    sizeButton: fonts.sizeButton || 16,
    sizeMessage: fonts.sizeMessage || 14
  };

  // Default labels
  const labelScheme = {
    title: labels.title || 'Have a promo code?',
    subtitle: labels.subtitle || 'Enter your referral code to unlock special offers',
    placeholder: labels.placeholder || 'Enter code (e.g., FITGURU30)',
    validateButton: labels.validateButton || 'Apply Code',
    skipButton: labels.skipButton || 'Skip',
    validatingMessage: labels.validatingMessage || 'Validating code...',
    validMessage: labels.validMessage || 'Code applied successfully!',
    invalidMessage: labels.invalidMessage || 'Invalid code. Please try again.',
    errorMessage: labels.errorMessage || 'Unable to validate code. Check your connection.',
    prefilledMessage: labels.prefilledMessage || 'Code detected from your referral link'
  };

  // Auto-prefill on mount
  useEffect(() => {
    if (autoPrefill) {
      loadPrefilledCode();
    }
  }, [autoPrefill]);

  const loadPrefilledCode = async () => {
    try {
      const prefilledCode = await InfluTo.getPrefilledCode();

      if (prefilledCode) {
        setCode(prefilledCode);
        setIsPrefilled(true);

        // Auto-validate if enabled
        if (autoValidate) {
          await handleValidate(prefilledCode);
        }
      }
    } catch (error) {
      console.error('[ReferralCodeInput] Failed to load prefilled code:', error);
    }
  };

  const handleValidate = async (codeToValidate: string = code) => {
    // Uppercase the code before validation
    const uppercaseCode = codeToValidate.toUpperCase();

    if (!uppercaseCode || uppercaseCode.length < 4) {
      setState('invalid');
      setValidationResult({
        valid: false,
        error: 'Please enter a valid code',
        error_code: 'INVALID_FORMAT'
      });
      return;
    }

    setState('validating');
    setValidationResult(null);

    try {
      const result = await InfluTo.validateCode(uppercaseCode);
      setValidationResult(result);

      if (result.valid) {
        setState('valid');

        // Automatically set the code if valid (use uppercase version)
        const setResult = await InfluTo.setReferralCode(uppercaseCode, appUserId);

        if (setResult.success) {
          onApplied?.(result);
        }
      } else {
        setState('invalid');
      }

      // Notify parent
      onValidated?.(result);
    } catch (error) {
      setState('error');
      setValidationResult({
        valid: false,
        error: 'Network error',
        error_code: 'NETWORK_ERROR'
      });

      onValidated?.({
        valid: false,
        error: 'Network error',
        error_code: 'NETWORK_ERROR'
      });
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  const handleBlur = () => {
    if (validateOnBlur && code && state === 'idle') {
      handleValidate();
    }
  };

  // Get message based on state
  const getMessage = () => {
    if (isPrefilled && state === 'idle') {
      return { text: labelScheme.prefilledMessage, color: colorScheme.primary };
    }

    switch (state) {
      case 'validating':
        return { text: labelScheme.validatingMessage, color: colorScheme.textSecondary };
      case 'valid':
        return {
          // The server `message` includes the influencer's personal name
          // ("Referred by <name>") — only surface it when explicitly opted in.
          text: (showReferrerName && validationResult?.message) || labelScheme.validMessage,
          color: colorScheme.success
        };
      case 'invalid':
        return {
          text: validationResult?.error || labelScheme.invalidMessage,
          color: colorScheme.error
        };
      case 'error':
        return { text: labelScheme.errorMessage, color: colorScheme.error };
      default:
        return null;
    }
  };

  const message = getMessage();

  return (
    <View style={[styles.container, style.container]}>
      {/* Title */}
      <View style={[styles.titleContainer, style.titleContainer]}>
        <Text style={[
          styles.title,
          { color: colorScheme.text, fontFamily: fontScheme.family, fontSize: fontScheme.sizeTitle },
          style.title
        ]}>
          {labelScheme.title}
        </Text>
        {labelScheme.subtitle && (
          <Text style={[
            styles.subtitle,
            { color: colorScheme.textSecondary, fontFamily: fontScheme.family, fontSize: fontScheme.sizeMessage },
            style.subtitle
          ]}>
            {labelScheme.subtitle}
          </Text>
        )}
      </View>

      {/* Input */}
      <View style={[styles.inputContainer, style.inputContainer]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colorScheme.inputBackground,
              borderColor: state === 'valid' ? colorScheme.success : state === 'invalid' || state === 'error' ? colorScheme.error : colorScheme.border,
              color: colorScheme.text,
              fontFamily: fontScheme.family,
              fontSize: fontScheme.sizeInput
            },
            style.input
          ]}
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (state !== 'idle' && state !== 'validating') {
              setState('idle');
              setValidationResult(null);
            }
          }}
          onBlur={handleBlur}
          placeholder={labelScheme.placeholder}
          placeholderTextColor={colorScheme.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={20}
          editable={state !== 'validating'}
          accessibilityLabel="Referral code input"
          accessibilityHint="Enter your promo or referral code"
        />

        {/* Success/Error Icon */}
        {state === 'valid' && (
          <View style={styles.iconContainer}>
            <Text style={[styles.icon, { color: colorScheme.success }]}>✓</Text>
          </View>
        )}
        {(state === 'invalid' || state === 'error') && (
          <View style={styles.iconContainer}>
            <Text style={[styles.icon, { color: colorScheme.error }]}>✗</Text>
          </View>
        )}
      </View>

      {/* Validation Message */}
      {message && (
        <View style={[styles.messageContainer, style.messageContainer]}>
          <Text style={[
            styles.messageText,
            { color: message.color, fontFamily: fontScheme.family, fontSize: fontScheme.sizeMessage },
            style.messageText
          ]}>
            {message.text}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View style={[styles.buttonContainer, style.buttonContainer]}>
        {/* Validate Button */}
        <TouchableOpacity
          style={[
            styles.validateButton,
            {
              backgroundColor: state === 'valid' ? colorScheme.success : colorScheme.primary,
              opacity: state === 'validating' || !code ? 0.6 : 1
            },
            style.validateButton
          ]}
          onPress={() => handleValidate()}
          disabled={state === 'validating' || !code}
          accessibilityLabel={labelScheme.validateButton}
          accessibilityRole="button"
        >
          {state === 'validating' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={[
              styles.validateButtonText,
              { fontFamily: fontScheme.family, fontSize: fontScheme.sizeButton },
              style.validateButtonText
            ]}>
              {state === 'valid' ? '✓ ' : ''}{labelScheme.validateButton}
            </Text>
          )}
        </TouchableOpacity>

        {/* Skip Button */}
        {showSkipButton && onSkip && (
          <TouchableOpacity
            style={[styles.skipButton, style.skipButton]}
            onPress={handleSkip}
            disabled={state === 'validating'}
            accessibilityLabel={labelScheme.skipButton}
            accessibilityRole="button"
          >
            <Text style={[
              styles.skipButtonText,
              { color: colorScheme.textSecondary, fontFamily: fontScheme.family, fontSize: fontScheme.sizeButton },
              style.skipButtonText
            ]}>
              {labelScheme.skipButton}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Campaign / referrer info (if valid) — both OFF by default */}
      {state === 'valid' &&
        ((showCampaignName && validationResult?.campaign) ||
          (showReferrerName && validationResult?.influencer)) && (
        <View style={styles.campaignInfo}>
          {showCampaignName && validationResult?.campaign && (
            <>
              <Text style={[
                styles.campaignTitle,
                { color: colorScheme.text, fontFamily: fontScheme.family }
              ]}>
                {validationResult.campaign.name}
              </Text>
              {validationResult.campaign.description && (
                <Text style={[
                  styles.campaignDescription,
                  { color: colorScheme.textSecondary, fontFamily: fontScheme.family }
                ]}>
                  {validationResult.campaign.description}
                </Text>
              )}
            </>
          )}
          {showReferrerName && validationResult?.influencer && (
            <Text style={[
              styles.influencerInfo,
              { color: colorScheme.textSecondary, fontFamily: fontScheme.family }
            ]}>
              Referred by {validationResult.influencer.name}
              {validationResult.influencer.social_handle && ` (@${validationResult.influencer.social_handle})`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  titleContainer: {
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 12
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 48, // Space for icon
    fontSize: 16,
    fontWeight: '500'
  },
  iconContainer: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  icon: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  messageContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12
  },
  validateButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  validateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  skipButton: {
    height: 50,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500'
  },
  campaignInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981'
  },
  campaignTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  campaignDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4
  },
  influencerInfo: {
    fontSize: 12,
    fontStyle: 'italic'
  }
});

export default ReferralCodeInput;
