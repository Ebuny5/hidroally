/**
 * NativePushService — real push delivery for the Capacitor Android/iOS shell.
 *
 * The Web Push pipeline (WebPushService + service worker) cannot work inside a
 * native WebView: there is no `PushManager` and service-worker push events are
 * never delivered while the app is closed. This service registers the device
 * with FCM/APNs instead and stores the device token in Supabase so the
 * `send-push-notification` edge function can reach it when the app is not running.
 *
 * Web builds are unaffected — every method is a no-op unless Capacitor reports a
 * native platform.
 */

import { supabase } from '@/integrations/supabase/client';

type CapPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (
    event: string,
    cb: (payload: any) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

type NativeModules = {
  isNative: boolean;
  PushNotifications?: CapPlugin;
  Capacitor?: any;
};

const TOKEN_KEY = 'sweatsmart:native_push:token';
const LAST_SYNC_KEY = 'sweatsmart:native_push:last_sync';
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

let mods: NativeModules | null = null;
let listenersAttached = false;
let registering = false;
let navigationHandler: ((url: string) => void) | null = null;

async function loadModules(): Promise<NativeModules> {
  if (mods) return mods;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform?.()) {
      mods = { isNative: false };
      return mods;
    }
    const { PushNotifications } = await import('@capacitor/push-notifications');
    mods = { isNative: true, PushNotifications: PushNotifications as unknown as CapPlugin, Capacitor };
  } catch (e) {
    console.warn('[NativePush] Capacitor push plugin unavailable:', e);
    mods = { isNative: false };
  }
  return mods;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function readCachedCoords(): { latitude: number; longitude: number } | null {
  try {
    const raw = localStorage.getItem('sweatsmart:lastCoords');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function getAppVersion(): Promise<string | null> {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist the FCM/APNs token so the server can push to this install.
 * A rotated token deletes the stale row first (FCM rotates tokens on reinstall,
 * data clear, or occasionally on its own).
 */
async function persistToken(token: string): Promise<boolean> {
  const m = await loadModules();
  if (!m.isNative || !m.Capacitor) return false;

  const platform = m.Capacitor.getPlatform();
  const previous = readStoredToken();
  const coords = readCachedCoords() ?? (await captureDeviceLocation());
  const appVersion = await getAppVersion();

  // Works signed in or as a guest: a guest install still receives climate alerts
  // while closed; signing in later links the same row to the account.
  const { error } = await (supabase.rpc as any)('register_native_device', {
    p_token: token,
    p_platform: platform,
    p_latitude: coords?.latitude ?? null,
    p_longitude: coords?.longitude ?? null,
    p_app_version: appVersion,
    p_previous_token: previous && previous !== token ? previous : null,
  });

  if (error) {
    console.error('[NativePush] Failed to store device token:', error.message);
    return false;
  }

  storeToken(token);
  console.log('[NativePush] Device registered for background push:', platform);
  return true;
}

/**
 * Read the phone's GPS once (native only) and cache it for background climate
 * alerts. Never throws; returns null when permission is denied or GPS is off.
 */
export async function captureDeviceLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const m = await loadModules();
  if (!m.isNative) return null;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      perm = await Geolocation.requestPermissions();
    }
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return null;
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 10 * 60 * 1000,
    });
    const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    try {
      localStorage.setItem('sweatsmart:lastCoords', JSON.stringify(coords));
    } catch {
      /* ignore */
    }
    return coords;
  } catch (e) {
    console.warn('[NativePush] Location unavailable:', e);
    return null;
  }
}

function attachListeners(m: NativeModules) {
  if (listenersAttached || !m.PushNotifications) return;
  listenersAttached = true;

  m.PushNotifications.addListener('registration', (token: { value?: string }) => {
    if (token?.value) void persistToken(token.value);
  });

  m.PushNotifications.addListener('registrationError', (err: unknown) => {
    console.warn('[NativePush] Registration failed:', err);
  });

  // Android does not display FCM notifications itself while the app is in the
  // foreground, so mirror the web behaviour (toast + sound + local notification).
  m.PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
    const data = notification?.data || {};
    const title = notification?.title || 'HidroAlly';
    const body = notification?.body || '';
    if (!title && !body) return;

    try {
      window.dispatchEvent(
        new CustomEvent('sweatsmart-notification', {
          detail: {
            title,
            body,
            type: 'info',
            channel: data.channel === 'climate' ? 'climate' : 'system',
          },
        }),
      );
    } catch {
      /* ignore */
    }

    void import('./NativeNotificationBridge').then(({ showNativeNotification }) =>
      showNativeNotification({
        title,
        body,
        url: data.url,
        channelId: data.channel === 'climate' ? 'climate' : 'reminder',
      }),
    );
  });

  m.PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
    const url = action?.notification?.data?.url;
    if (!url) return;
    if (navigationHandler) navigationHandler(url);
    else window.location.assign(url);
  });
}

async function registerDevice(m: NativeModules): Promise<boolean> {
  if (!m.PushNotifications || registering) return false;
  registering = true;
  try {
    await m.PushNotifications.register();
    return true;
  } catch (e) {
    console.warn('[NativePush] register() failed:', e);
    return false;
  } finally {
    registering = false;
  }
}

/**
 * Attach listeners and register if permission is already granted.
 * Safe to call repeatedly.
 */
export async function initializeNativePush(): Promise<boolean> {
  const m = await loadModules();
  if (!m.isNative || !m.PushNotifications) return false;

  attachListeners(m);

  try {
    const perm = await m.PushNotifications.checkPermissions();
    if (perm.receive === 'granted') return registerDevice(m);
  } catch (e) {
    console.warn('[NativePush] checkPermissions failed:', e);
  }
  return false;
}

/**
 * Ask for OS permission (call from a user gesture or the existing permission flow)
 * and register when granted.
 */
export async function requestNativePushPermissionAndRegister(): Promise<boolean> {
  const m = await loadModules();
  if (!m.isNative || !m.PushNotifications) return false;

  attachListeners(m);
  try {
    const perm = await m.PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    return registerDevice(m);
  } catch (e) {
    console.warn('[NativePush] requestPermissions failed:', e);
    return false;
  }
}

/**
 * Refresh the device row (user binding, location, app version, last-seen) and
 * re-register when the token is stale. Called on login and on app resume.
 */
export async function syncNativePushContext(): Promise<void> {
  const m = await loadModules();
  if (!m.isNative || !m.PushNotifications) return;

  attachListeners(m);

  try {
    const perm = await m.PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return;

    const token = readStoredToken();
    if (!token) {
      await registerDevice(m);
      return;
    }

    // Refresh location, app version and account binding (guest or signed in).
    const ok = await persistToken(token);
    if (!ok) {
      await registerDevice(m);
      return;
    }

    const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    if (Date.now() - lastSync > SYNC_INTERVAL_MS) {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      await registerDevice(m);
    }
  } catch (e) {
    console.warn('[NativePush] context sync failed:', e);
  }
}

/** Let the SPA handle taps from a cold start as well as from the background. */
export function setNativePushNavigationHandler(handler: ((url: string) => void) | null) {
  navigationHandler = handler;
}

/**
 * Unlink this device from the signed-in account on sign-out. The device stays
 * registered as a guest, so climate alerts keep arriving while closed, but the
 * next account on the phone does not inherit the previous user's reminders.
 */
export async function clearNativePushBinding(): Promise<void> {
  const m = await loadModules();
  if (!m.isNative || !m.Capacitor) return;

  const token = readStoredToken();
  if (!token) return;

  try {
    await (supabase.rpc as any)('unbind_native_device', {
      p_token: token,
      p_platform: m.Capacitor.getPlatform(),
    });
  } catch {
    /* best effort */
  }
}
