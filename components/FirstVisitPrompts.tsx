'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Stack, Text, CloseButton } from '@mantine/core';
import { IconDownload, IconBell, IconDeviceMobile, IconShare } from '@tabler/icons-react';
import Link from 'next/link';

type Step = 'install' | 'notifications' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const LS_INSTALL_DISMISSED = 'isignal-install-dismissed';
const LS_NOTIF_DISMISSED = 'isignal-notif-dismissed';

// How many days to wait before re-showing a dismissed prompt
const REMIND_INTERVAL_DAYS = 5;

function isDismissedRecently(key: string): boolean {
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  // Permanent dismiss (user accepted install, or notifications already enabled)
  if (raw === 'permanent') return true;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < REMIND_INTERVAL_DAYS;
}

function dismissTemporarily(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

function dismissPermanently(key: string) {
  localStorage.setItem(key, 'permanent');
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iP(hone|od|ad)/.test(ua) && /WebKit/.test(ua) && !/(CriOS|FxiOS|OPiOS|mercury)/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function FirstVisitPrompts() {
  const [step, setStep] = useState<Step>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const promptFiredRef = useRef(false);
  const didRunRef = useRef(false);

  useEffect(() => {
    // Only run once across page navigations
    if (didRunRef.current) return;
    didRunRef.current = true;

    // Already running as installed PWA — skip everything
    if (isStandalone()) return;

    const installDismissed = isDismissedRecently(LS_INSTALL_DISMISSED);
    const notifDismissed = isDismissedRecently(LS_NOTIF_DISMISSED);
    const notifSupported = 'Notification' in window;
    const notifNeeded = notifSupported && Notification.permission === 'default' && !notifDismissed;

    // iOS Safari — no beforeinstallprompt, show manual instructions
    if (isIOSSafari() && !installDismissed) {
      setIsIOS(true);
      setStep('install');
      return;
    }

    // Non-iOS: listen for beforeinstallprompt
    if (!installDismissed) {
      const handler = (e: Event) => {
        e.preventDefault();
        promptFiredRef.current = true;
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setStep('install');
      };
      window.addEventListener('beforeinstallprompt', handler);

      // If no prompt fires within 2s, browser doesn't support install prompt.
      // Skip install step entirely and move to notifications or close.
      const timeout = setTimeout(() => {
        if (!promptFiredRef.current) {
          window.removeEventListener('beforeinstallprompt', handler);
          // Auto-dismiss install for browsers that don't support it
          dismissTemporarily(LS_INSTALL_DISMISSED);
          if (notifNeeded) {
            setStep('notifications');
          }
        }
      }, 2000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(timeout);
      };
    }

    // Install already dismissed — check notifications
    if (notifNeeded) {
      setStep('notifications');
    }
  }, []);

  const moveToNotificationsOrClose = () => {
    const notifSupported = 'Notification' in window;
    const notifDismissed = isDismissedRecently(LS_NOTIF_DISMISSED);
    if (notifSupported && Notification.permission === 'default' && !notifDismissed) {
      setStep('notifications');
    } else {
      setStep(null);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        dismissPermanently(LS_INSTALL_DISMISSED);
        setDeferredPrompt(null);
        moveToNotificationsOrClose();
        return;
      }
    }
    // Dismissed — re-show after REMIND_INTERVAL_DAYS
    dismissInstall();
  };

  const dismissInstall = () => {
    dismissTemporarily(LS_INSTALL_DISMISSED);
    moveToNotificationsOrClose();
  };

  const dismissNotifications = () => {
    dismissTemporarily(LS_NOTIF_DISMISSED);
    setStep(null);
  };

  if (!step) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'calc(100% - 32px)',
        maxWidth: 420,
      }}
    >
      <Box
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--sidebar-border)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '20px',
          backdropFilter: 'blur(20px)',
        }}
      >
        {step === 'install' && (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Group gap="sm" align="center">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--orange-tint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconDeviceMobile size={22} color="var(--orange)" />
                </Box>
                <Box>
                  <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
                    Add to Home Screen
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                    Quick access like a native app
                  </Text>
                </Box>
              </Group>
              <CloseButton size="sm" onClick={dismissInstall} />
            </Group>

            {isIOS ? (
              <Box
                style={{
                  background: 'var(--orange-tint)',
                  borderRadius: 10,
                  padding: '12px',
                }}
              >
                <Group gap={6} align="center" mb={4}>
                  <IconShare size={16} color="var(--orange)" />
                  <Text size="xs" fw={600} style={{ color: 'var(--orange)' }}>
                    How to install on iOS
                  </Text>
                </Group>
                <Text size="xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  1. Tap the <strong>Share</strong> button in Safari <br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>
                  <br />
                  3. Tap <strong>Add</strong>
                </Text>
              </Box>
            ) : (
              <Button
                fullWidth
                size="sm"
                radius="md"
                leftSection={<IconDownload size={16} />}
                onClick={handleInstall}
                style={{
                  background: 'var(--orange)',
                  color: '#fff',
                }}
              >
                Install App
              </Button>
            )}

            {isIOS && (
              <Button
                fullWidth
                size="sm"
                radius="md"
                variant="subtle"
                onClick={dismissInstall}
                style={{ color: 'var(--text-muted)' }}
              >
                Got it
              </Button>
            )}
          </Stack>
        )}

        {step === 'notifications' && (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Group gap="sm" align="center">
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--orange-tint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBell size={22} color="var(--orange)" />
                </Box>
                <Box>
                  <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
                    Enable Reminders
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-muted)' }}>
                    Get nudges to log your metrics
                  </Text>
                </Box>
              </Group>
              <CloseButton size="sm" onClick={dismissNotifications} />
            </Group>

            <Button
              fullWidth
              size="sm"
              radius="md"
              component={Link}
              href="/settings"
              leftSection={<IconBell size={16} />}
              onClick={() => {
                dismissPermanently(LS_NOTIF_DISMISSED);
                setStep(null);
              }}
              style={{
                background: 'var(--orange)',
                color: '#fff',
              }}
            >
              Go to Settings
            </Button>

            <Button
              fullWidth
              size="xs"
              radius="md"
              variant="subtle"
              onClick={dismissNotifications}
              style={{ color: 'var(--text-muted)' }}
            >
              Maybe later
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
