import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { startEmailLogin, verifyEmailLogin } from "../services/accountApi";

const C = {
  bg: "#0B0E11",
  surface: "#14181C",
  raised: "#1B2126",
  border: "#283036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#8E979E",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.12)",
  green: "#48C78E",
};

export default function Phase4BAuthModal({
  visible,
  onClose,
  onSuccess,
  language = "my",
}) {
  const my = language === "my";
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reset = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setBusy(false);
    setError("");
    setMessage("");
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleSendCode = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError(my ? "မှန်ကန်သော အီးမေးလ် ထည့်သွင်းပါ" : "Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await startEmailLogin(clean);
      setEmail(clean);
      setStep("code");
      setMessage(
        my
          ? `${clean} သို့ အတည်ပြုကုဒ် ပို့ပြီးပါပြီ။ Email စစ်ဆေးပါ။`
          : `Verification code sent to ${clean}. Please check your inbox.`,
      );
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်ပို့၍ မရပါ" : "Could not send verification code."));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError(my ? "အတည်ပြုကုဒ် ထည့်ပါ" : "Enter the verification code.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await verifyEmailLogin(email, cleanCode);
      if (!result?.status?.authenticated) {
        throw new Error(
          my
            ? "အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ။ ပြန်စမ်းပါ။"
            : "Sign-in failed. Please try the code again.",
        );
      }
      handleClose();
      onSuccess?.(result.status.user);
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်မှားယွင်းနေပါသည်" : "Verification failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await startEmailLogin(email, { resend: true });
      setCode("");
      setMessage(
        my
          ? "အတည်ပြုကုဒ်အသစ် ပို့ပြီးပါပြီ။"
          : "A new verification code has been sent.",
      );
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်အသစ်ပို့၍ မရသေးပါ" : "Could not resend code."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.backdrop}
      >
        <Pressable style={s.scrim} onPress={handleClose} />
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.badge}>
              <Text style={s.badgeText}>MST</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sign in"
              hitSlop={8}
              onPress={handleClose}
              style={s.closeBtn}
            >
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>
          </View>

          <Text style={s.title}>
            {my ? "MST အကောင့်သို့ ဝင်ရောက်ပါ" : "Sign in to MST"}
          </Text>
          <Text style={s.subtitle}>
            {my
              ? "myanmarsportstalk.com တွင်သုံးသော Email ဖြင့် အကောင့်တူတူ သုံးနိုင်ပါသည်။ Favorites နှင့် ပရိုဖိုင် ချိတ်ဆက်ပါမည်။"
              : "Use your Myanmar Sports Talk account email. Your favorites and profile will sync across devices."}
          </Text>

          {message ? (
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={C.green} />
              <Text style={s.infoText}>{message}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.red} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === "email" ? (
            <View style={s.form}>
              <Text style={s.label}>{my ? "အီးမေးလ်" : "Email address"}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="name@example.com"
                placeholderTextColor={C.muted}
                style={s.input}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleSendCode}
                style={[s.primaryBtn, busy && s.disabledBtn]}
              >
                {busy ? (
                  <ActivityIndicator color={C.text} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>
                    {my ? "အတည်ပြုကုဒ် ရယူမည်" : "SEND VERIFICATION CODE"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.label}>{my ? "အတည်ပြုကုဒ် (၆ လုံး)" : "6-digit code"}</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                editable={!busy}
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={C.muted}
                style={[s.input, s.codeInput]}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleVerifyCode}
                style={[s.primaryBtn, busy && s.disabledBtn]}
              >
                {busy ? (
                  <ActivityIndicator color={C.text} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>
                    {my ? "အတည်ပြုပြီး အကောင့်ဝင်မည်" : "VERIFY & SIGN IN"}
                  </Text>
                )}
              </Pressable>

              <View style={s.codeActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={handleResend}
                  style={s.secondaryAction}
                >
                  <Text style={s.secondaryActionText}>
                    {my ? "ကုဒ်အသစ် ပြန်ပို့ပါ" : "Resend code"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                    setMessage("");
                  }}
                  style={s.secondaryAction}
                >
                  <Text style={s.secondaryActionText}>
                    {my ? "အီးမေးလ် ပြောင်းမည်" : "Change email"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.redSoft,
  },
  badgeText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: C.raised,
  },
  title: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: C.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(72,199,142,0.1)",
    borderWidth: 1,
    borderColor: C.green,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  infoText: {
    color: C.secondary,
    fontSize: 12,
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: C.red,
    fontSize: 12,
    flex: 1,
  },
  form: {
    marginTop: 4,
  },
  label: {
    color: C.secondary,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 14.5,
    marginBottom: 14,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 6,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: C.text,
    fontSize: 13.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  codeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingHorizontal: 4,
  },
  secondaryAction: {
    paddingVertical: 4,
  },
  secondaryActionText: {
    color: C.muted,
    fontSize: 12.5,
    textDecorationLine: "underline",
  },
});
