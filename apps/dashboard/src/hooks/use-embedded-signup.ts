"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Meta's Embedded Signup for WhatsApp, browser side.
 *
 * Loads the Facebook JS SDK once, then `start()` opens the signup dialog.
 * Two things come back independently: a `message` event from facebook.com
 * with the WABA and phone number ids, and the `FB.login` callback with the
 * short lived code. `onComplete` fires once both are in hand; the server
 * does the rest (see @retransmit/whatsapp/meta-signup).
 *
 * The dialog offers two paths. The standard one verifies a number that is
 * not in use anywhere else and ends with `FINISH`. The WhatsApp Business app
 * path (Meta calls it Coexistence) connects a number the business already
 * uses in the app, by scanning a QR code from the phone, and ends with
 * `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, which carries the WABA id but
 * no phone number id; the server looks the number up on the WABA.
 */

interface FacebookSdk {
  init(options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
  login(
    callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
    options: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const META_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

/** Makes the dialog offer the "use your WhatsApp Business app number" path. */
const BUSINESS_APP_FEATURE = "whatsapp_business_app_onboarding";

export interface SignupResult {
  code: string;
  wabaId: string;
  /** Absent when the number came through the WhatsApp Business app path. */
  phoneNumberId?: string;
  /** True for the WhatsApp Business app path (Coexistence). */
  businessApp: boolean;
}

export interface EmbeddedSignupOptions {
  appId: string;
  configId: string;
  apiVersion: string;
  onComplete: (result: SignupResult) => void;
  onCancel?: (step: string | undefined) => void;
  onError?: (message: string) => void;
}

interface Pending {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessApp?: boolean;
  /** Set once the dialog reported a usable outcome. */
  dialogDone?: boolean;
}

export function useEmbeddedSignup(options: EmbeddedSignupOptions | null) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const pending = useRef<Pending>({});
  const latest = useRef(options);
  latest.current = options;

  // Load the SDK once per page.
  useEffect(() => {
    if (!options) return;
    if (window.FB) {
      setReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: options.appId, autoLogAppEvents: true, xfbml: false, version: options.apiVersion });
      setReady(true);
    };
    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, [options?.appId, options?.apiVersion, options]);

  const finish = useCallback(() => {
    const { code, wabaId, phoneNumberId, businessApp, dialogDone } = pending.current;
    if (!code || !wabaId || !dialogDone) return;
    pending.current = {};
    setRunning(false);
    latest.current?.onComplete({ code, wabaId, phoneNumberId, businessApp: businessApp === true });
  }, []);

  // The dialog posts its outcome to the opener as a JSON string.
  useEffect(() => {
    if (!options) return;
    const listener = (event: MessageEvent) => {
      if (!META_ORIGINS.has(event.origin) || typeof event.data !== "string") return;
      let data: { type?: string; event?: string; data?: Record<string, string | undefined> };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type !== "WA_EMBEDDED_SIGNUP") return;

      if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
        pending.current.wabaId = data.data?.waba_id;
        pending.current.phoneNumberId = data.data?.phone_number_id;
        pending.current.businessApp = false;
        if (!pending.current.phoneNumberId) {
          pending.current = {};
          setRunning(false);
          latest.current?.onError?.(
            "Add a phone number in WhatsApp Manager, then try again.",
          );
          return;
        }
        pending.current.dialogDone = true;
        finish();
      } else if (data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        pending.current.wabaId = data.data?.waba_id;
        pending.current.phoneNumberId = data.data?.phone_number_id;
        pending.current.businessApp = true;
        if (!pending.current.wabaId) {
          pending.current = {};
          setRunning(false);
          latest.current?.onError?.("Meta did not return a WhatsApp Business Account. Try again.");
          return;
        }
        pending.current.dialogDone = true;
        finish();
      } else if (data.event === "CANCEL") {
        pending.current = {};
        setRunning(false);
        latest.current?.onCancel?.(data.data?.current_step);
      } else if (data.event === "ERROR") {
        pending.current = {};
        setRunning(false);
        latest.current?.onError?.(data.data?.error_message ?? "Meta signup failed");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [options, finish]);

  const start = useCallback(() => {
    const current = latest.current;
    if (!current || !window.FB) return;
    pending.current = {};
    setRunning(true);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          pending.current = {};
          setRunning(false);
          current.onCancel?.(undefined);
          return;
        }
        pending.current.code = code;
        finish();
      },
      {
        config_id: current.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: BUSINESS_APP_FEATURE, sessionInfoVersion: "3" },
      },
    );
  }, [finish]);

  return { ready, running, start };
}
