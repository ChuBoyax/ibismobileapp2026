import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ApiError, login as loginRequest } from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import { warmFormSources } from '@/features/registration/use-form-sources';
import { warmOfflineData } from '@/lib/warm-offline-data';
import {
  getSavedEmail,
  hasPasswordProof,
  hasPin,
  saveEmail,
  savePasswordProof,
  setOfflineSession,
  saveProfile,
  saveToken,
  verifyPassword,
} from '@/lib/auth-storage';
import { switchUser } from '@/lib/session';
import { resumeSync } from '@/lib/sync';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = {
  email?: string;
  password?: string;
};

/**
 * Sa ibaba nito, masikip na ang screen para sa buong header.
 *
 * Karamihan ng cellphone ngayon ay lampas 800dp ang taas; ang mga mura at
 * maliliit — na siyang laganap sa barangay — ay nasa 640 hanggang 700. Doon
 * hindi na kasya ang malaking selyo kasama ang card, at lalong hindi kapag
 * nakaangat na ang keyboard.
 */
const SHORT_SCREEN_DP = 720;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  // Ang taas ng window ang sinusukat, hindi ang uri ng cellphone — kaya
  // sumasabay ito sa split-screen at sa pagbaligtad ng screen. Kung umuurong
  // din ito paglabas ng keyboard, lalo pang lumiliit ang header, at iyon
  // naman ang gusto nating mangyari sa sandaling iyon.
  const { height } = useWindowDimensions();
  const compact = height < SHORT_SCREEN_DP;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Iniiwasan ang setState pagkatapos umalis sa screen habang tumatakbo pa
  // ang request — hindi kayang kanselahin ng React ang natapos nang await.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /*
    ANG PAG-ANGAT NG KEYBOARD AY NAGTATABON SA MGA FIELD.

    Umuurong ang window kapag lumabas ang keyboard (adjustResize ang gamit ng
    Android dito), kaya nagiging ma-scroll ang nilalaman — pero walang kusang
    gumagalaw. Sa maliit na cellphone, ang natatabunan ay ang mismong
    pinipindot: ang password at ang LOG IN.

    Kaya sa sandaling umangat ito, dinadala natin ang dulo ng nilalaman sa
    tanaw. Dalawang pagkakataon ang ginagamit dahil magkaiba ang oras nila sa
    bawat aparato: ang abiso ng keyboard, at ang pag-urong mismo ng ScrollView.
    Alinman ang mauna, tama pa rin ang kalalabasan.
  */
  const scrollRef = useRef<ScrollView>(null);
  const keyboardUp = useRef(false);

  function revealFields() {
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  useEffect(() => {
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        keyboardUp.current = true;
        revealFields();
      }
    );

    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardUp.current = false;
      }
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Alam naman ng app kung sino ang huling gumamit ng cellphone na ito.
  // Ipapasok na natin ang email para password na lang ang itatype niya —
  // lalo nang mahalaga kapag kailangan niyang mag-login ulit para makapag-sync.
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    let active = true;

    getSavedEmail()
      .then((saved) => {
        if (!active || !saved) return;
        setEmail(saved);
        setReturning(true);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  function validate() {
    const next: Errors = {};

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    return next;
  }

  /**
   * Pagpasok gamit ang naka-save na patunay. Walang token — imposible iyon
   * nang hindi nakakausap ang server — kaya ang naka-save na datos lang ang
   * makikita hanggang bumalik ang koneksyon.
   *
   * MAHALAGA ANG TUMPAK NA MENSAHE DITO. Dati, ang maling password offline ay
   * sinasagot ng "Cannot reach the server" — iisipin ng user na signal ang
   * problema at paulit-ulit siyang susubok kahit ang password lang pala ang
   * mali. Kaya bawat dahilan ay may sariling sagot.
   */
  async function signInOffline(
    normalized: string,
    secret: string
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const [saved, hasProof] = await Promise.all([getSavedEmail(), hasPasswordProof()]);
    const savedEmail = saved?.trim().toLowerCase();

    if (!savedEmail || !hasProof) {
      return {
        ok: false,
        message:
          'No internet connection. Sign in once while connected so this device can recognize you offline.',
      };
    }

    if (savedEmail !== normalized) {
      return {
        ok: false,
        message: `No internet connection. This device can only sign in offline as ${savedEmail}.`,
      };
    }

    if (!(await verifyPassword(secret))) {
      return { ok: false, message: 'Incorrect password.' };
    }

    await setOfflineSession(true);

    if (mounted.current) setLoading(false);
    router.replace((await hasPin()) ? '/dashboard' : '/setup-security');

    return { ok: true };
  }

  /** Ipinapakita ang tumpak na dahilan ng pagkabigo ng offline na pagpasok. */
  function showOfflineError(message: string) {
    if (!mounted.current) return;

    setLoading(false);
    setFormError(message);
  }

  async function handleLogin() {
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const normalized = email.trim().toLowerCase();
    setLoading(true);

    try {
      // Kapag alam na ng cellphone na walang koneksyon, walang saysay na
      // maghintay ng timeout — diretso na sa naka-save na patunay.
      if (!(await isDeviceOnline())) {
        const offline = await signInOffline(normalized, password);

        if (offline.ok) return;

        showOfflineError(offline.message);
        return;
      }

      const { token, user } = await loginRequest(normalized, password);

      // Kung iba ang nag-login kaysa sa huling gumamit, linisin muna ang
      // naiwan ng nauna bago pumasok ang bago.
      await switchUser(user.email);

      await Promise.all([
        saveToken(token),
        saveProfile(user),
        // Laging maliit ang letra kapag itinatabi, para tumugma sa paghahambing
        // mamaya kahit iba ang laki ng letrang tinipa o isinagot ng server.
        saveEmail(user.email.trim().toLowerCase()),
        // Patunay para sa offline na login sa susunod. Hash lang ito — hindi
        // naitatago ang mismong password.
        savePasswordProof(password),
        // May tunay nang token — hindi na offline ang pagpasok na ito.
        setOfflineSession(false),
      ]);

      // May bagong token na — kung may naghihintay na tala na huminto dahil
      // nawalan ng bisa ang luma, ipagpatuloy agad.
      resumeSync();

      // Habang tiyak na may koneksyon, inihahanda ang laman ng registration
      // form. Kung hindi ngayon, ang unang pagbukas ng form sa lugar na
      // walang signal ang mabibigo — at huli na doon.
      void warmFormSources();

      // Lahat ng ipapakita ng app — dashboard, ulat, at tatlong listahan.
      // Isang beses habang may signal, para may laman kahit saan dalhin.
      void warmOfflineData();

      // Kapag wala pang PIN, dumadaan muna sa security setup bago ang dashboard.
      // replace (hindi push) para hindi na makabalik sa login gamit ang back button.
      const next = (await hasPin()) ? '/dashboard' : '/setup-security';

      if (mounted.current) setLoading(false);
      router.replace(next);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : -1;

      // Hindi maabot ang server. Kung nakapag-login na dati ang taong ito sa
      // cellphone na ito, papasukin siya gamit ang naka-save na patunay — ang
      // datos na makikita niya ay ang huling nakuha, at maghihintay sa pila
      // ang anumang idadagdag niya.
      if (status === 0) {
        const offline = await signInOffline(normalized, password);

        if (offline.ok) return;

        showOfflineError(offline.message);
        return;
      }

      if (!mounted.current) return;

      setLoading(false);
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      );
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Umuurong ang ScrollView kapag umangat ang keyboard. Dito natin
          // nasisiguro ang pag-scroll kahit dumating ang abiso ng keyboard
          // bago pa matapos ang bagong sukat.
          onLayout={() => {
            if (keyboardUp.current) revealFields();
          }}>
          {/* Larawan ng bayan, may gradient sa ibabaw at curved na ilalim */}
          <ImageBackground
            source={require('../../assets/images/batomn.jpg')}
            style={styles.header}
            imageStyle={styles.headerImage}
            resizeMode="cover">
            {/*
              GRADIENT, HINDI PANTAY NA TAKIP.

              Ang pantay na takip ay pinapatay ang buong larawan nang sabay —
              nawawala ang dahilan kung bakit ito inilagay. Ang gradient ay
              pinapayagang huminga ang itaas, kung saan walang teksto, at
              dinidiliman lang ang ibaba kung saan nakatayo ang pangalan ng
              sistema at kung saan ito sumasalubong sa puting card.

              ANG LAKAS AY SINUKAT, HINDI HINULA. Ang pinakamasamang kaso ay
              puting bahagi ng larawan sa likod ng puting teksto. Sa bawat
              lugar na may teksto:

                selyo (itaas, 5%)      0.38  — walang teksto, may puting
                                              singsing ang selyo mismo
                pamagat (56%)          0.72  — 5.25:1, hangganan 3.0 (malaki)
                subtitle (78%)         0.82  — 6.27:1, hangganan 4.5 (maliit)
                ilalim (100%)          0.92  — 9.49:1

              Ang 0.55 na hantungan ng gitnang hinto ay hindi basta napili:
              doon nagsisimula ang pamagat. Kung itataas iyon, ang teksto ay
              mapupunta sa maliwanag na bahagi at mawawala ang buong margin.
            */}
            <LinearGradient
              colors={['rgba(14,63,33,0.35)', 'rgba(14,63,33,0.72)', 'rgba(14,63,33,0.92)']}
              locations={[0, 0.55, 1]}
              style={styles.scrim}
            />

            <View
              style={[
                styles.headerInner,
                compact && styles.headerInnerCompact,
                { paddingTop: insets.top + (compact ? Spacing.lg : Spacing.xxl) },
              ]}>
              <View style={[styles.sealRing, compact && styles.sealRingCompact]}>
                <Image
                  source={require('../../assets/images/batologo-256.png')}
                  style={[styles.seal, compact && styles.sealCompact]}
                  resizeMode="contain"
                  accessibilityLabel="Seal of the Municipality of Bato, Leyte"
                />
              </View>

              <Text style={[styles.appTitle, compact && styles.appTitleCompact]}>
                Integrated Barangay{'\n'}Information System
              </Text>
              <Text style={styles.appSubtitle}>Municipality of Bato, Province of Leyte</Text>
            </View>
          </ImageBackground>

          {/* Puting card na nakapatong sa header */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {returning ? 'Welcome back' : 'Sign in to your account'}
            </Text>

            {!!formError && (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{formError}</Text>
              </View>
            )}

            <TextField
              label="Email"
              icon="mail-outline"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                if (formError) setFormError('');
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                if (formError) setFormError('');
              }}
              error={errors.password}
              secure
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              // Kilala na ang user — sa password na agad ang cursor.
              autoFocus={returning}
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>LOG IN</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    // Nananatili ang berde sa ilalim ng larawan: iyon ang makikita habang
    // hindi pa naibabalik ang litrato, at kapag hindi ito mabasa.
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  headerImage: {
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerInner: {
    alignItems: 'center',
    paddingBottom: Spacing.xxl + Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  headerInnerCompact: {
    // Sa masikip na screen, ang taas ang unang binabawasan.
    paddingBottom: Spacing.xxl,
  },
  sealRing: {
    width: 112,
    height: 112,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 4,
    borderColor: Colors.primaryLight,
  },
  sealRingCompact: {
    width: 84,
    height: 84,
    marginBottom: Spacing.md,
  },
  seal: {
    width: 92,
    height: 92,
  },
  sealCompact: {
    width: 68,
    height: 68,
  },
  appTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
  appTitleCompact: {
    fontSize: FontSize.lg,
    lineHeight: 25,
  },
  appSubtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  card: {
    marginTop: -Spacing.xxl,
    marginHorizontal: Spacing.xl,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  banner: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: '#FDECEA',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  bannerText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    fontWeight: '600',
  },
  button: {
    marginTop: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
    letterSpacing: 1,
  },
});
