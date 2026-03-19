'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActionIcon, AppShell, Avatar, Box, Group, NavLink, Stack, Text, UnstyledButton, rem } from '@mantine/core';
import {
  IconHome,
  IconChartLine,
  IconLayoutGrid,
  IconBulb,
  IconLogout,
  IconRefresh,
  IconList,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useSession, signOut } from 'next-auth/react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import Image from 'next/image';

const NAV = [
  { href: '/today', label: 'Today', Icon: IconHome },
  { href: '/trends', label: 'Trends', Icon: IconChartLine },
  { href: '/metrics', label: 'Metrics', Icon: IconLayoutGrid },
  { href: '/insights', label: 'Insights', Icon: IconBulb },
  { href: '/logs', label: 'Logs', Icon: IconList },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const online = useOnlineStatus();
  const [profileOpen, setProfileOpen] = useState(false);

  // Close profile overlay on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-profile-menu]')) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  return (
    <>
      <AppShell
        navbar={{
          width: 230,
          breakpoint: 'sm',
          collapsed: { mobile: true },
        }}
        padding={0}
        style={{ background: 'transparent' }}
      >
        {/* ── DESKTOP SIDEBAR ── */}
        <AppShell.Navbar
          className="desktop-sidebar"
          style={{
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--sidebar-border)',
            backdropFilter: 'blur(40px)',
          }}
        >
          <Stack h="100%" gap={0}>
            {/* Logo */}
            <Box
              p="lg"
              style={{
                borderBottom: '1px solid var(--sidebar-border)',
              }}
            >
              <Group gap="sm">
                <Image src="/android-icon-192x192.png" alt="iSignal" width={60} height={60} />
                <Box>
                  <Text
                    fw={700}
                    size="md"
                    style={{
                      letterSpacing: '-0.03em',
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    iSignal
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      color: 'var(--text-muted)',
                    }}
                  >
                    Activity Logger
                  </Text>
                </Box>
              </Group>
            </Box>

            {/* Nav */}
            <Stack gap={2} p="sm" style={{ flex: 1 }}>
              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                style={{
                  letterSpacing: '0.09em',
                  color: 'var(--text-faint)',
                  padding: '10px 8px 4px',
                }}
              >
                Main
              </Text>
              {NAV.map(({ href, label, Icon }) => {
                const active = pathname === href;
                return (
                  <NavLink
                    key={href}
                    component={Link}
                    href={href}
                    label={label}
                    leftSection={<Icon size={17} stroke={active ? 2 : 1.5} />}
                    active={active}
                    styles={{
                      root: {
                        borderRadius: 10,
                        background: active ? 'var(--orange-tint)' : 'transparent',
                        fontWeight: active ? 600 : 400,
                        fontSize: 14,
                        color: active ? 'var(--orange)' : 'var(--text-secondary)',
                      },
                      label: {
                        color: active ? 'var(--orange)' : 'var(--text-secondary)',
                      },
                    }}
                  />
                );
              })}
            </Stack>

            {/* User / Profile popover */}
            <Box
              p="sm"
              data-profile-menu
              style={{
                borderTop: '1px solid var(--sidebar-border)',
                position: 'relative',
              }}
            >
              <UnstyledButton onClick={() => setProfileOpen((o) => !o)} style={{ width: '100%' }}>
                <Group
                  gap="sm"
                  p="sm"
                  style={{
                    borderRadius: 10,
                  }}
                >
                  <Avatar
                    src={session?.user?.image}
                    size={32}
                    radius="xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--orange), var(--purple))',
                    }}
                  >
                    {session?.user?.name?.[0] ?? '?'}
                  </Avatar>
                  <Box
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Text
                      size="sm"
                      fw={600}
                      truncate
                      style={{
                        color: 'var(--text-primary)',
                      }}
                    >
                      {session?.user?.name ?? 'User'}
                    </Text>
                    <Text
                      size="xs"
                      truncate
                      style={{
                        color: 'var(--text-muted)',
                      }}
                    >
                      {session?.user?.email ?? ''}
                    </Text>
                  </Box>
                </Group>
              </UnstyledButton>

              {/* Profile overlay */}
              {profileOpen && (
                <Box
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 8,
                    right: 8,
                    marginBottom: 4,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--sidebar-border)',
                    borderRadius: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    zIndex: 300,
                  }}
                >
                  <NavLink
                    component={Link}
                    href="/settings"
                    label="Settings"
                    leftSection={<IconSettings size={16} />}
                    onClick={() => setProfileOpen(false)}
                    styles={{
                      root: {
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        '&:hover': { background: 'var(--orange-tint)' },
                      },
                    }}
                  />
                  <NavLink
                    label="Sign out"
                    leftSection={<IconLogout size={16} />}
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    styles={{
                      root: {
                        fontSize: 13,
                        color: 'var(--red, #e03131)',
                      },
                    }}
                  />
                </Box>
              )}
            </Box>
          </Stack>
        </AppShell.Navbar>

        {/* ── MAIN ── */}
        <AppShell.Main
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'transparent',
          }}
        >
          {/* Mobile top bar */}
          <Group
            className="mobile-only"
            justify="space-between"
            align="center"
            px="md"
            py="xs"
            style={{
              borderBottom: '1px solid var(--sidebar-border)',
              background: 'var(--sidebar-bg)',
              backdropFilter: 'blur(20px)',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <Group gap={8}>
              <Image src="/android-icon-192x192.png" alt="iSignal" width={28} height={28} />
              <Box>
                <Text
                  fw={700}
                  size="sm"
                  style={{
                    letterSpacing: '-0.03em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                  }}
                >
                  iSignal
                </Text>
                <Text
                  size="xs"
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 10,
                  }}
                >
                  Activity Logger
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <ActionIcon size="lg" radius="md" aria-label="Refresh" onClick={() => window.location.reload()}>
                <IconRefresh size={18} />
              </ActionIcon>
              <ThemeSwitcher />
              <Box data-profile-menu style={{ position: 'relative' }}>
                <ActionIcon
                  size="lg"
                  radius="md"
                  variant="outline"
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-label="Profile menu"
                >
                  <IconUser size={18} />
                </ActionIcon>

                {/* Mobile profile overlay */}
                {profileOpen && (
                  <Box
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 8,
                      width: 200,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--sidebar-border)',
                      borderRadius: 10,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                      overflow: 'hidden',
                      zIndex: 300,
                    }}
                  >
                    <Box p="sm" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                      <Text size="sm" fw={600} truncate style={{ color: 'var(--text-primary)' }}>
                        {session?.user?.name ?? 'User'}
                      </Text>
                      <Text size="xs" truncate style={{ color: 'var(--text-muted)' }}>
                        {session?.user?.email ?? ''}
                      </Text>
                    </Box>
                    <NavLink
                      component={Link}
                      href="/settings"
                      label="Settings"
                      leftSection={<IconSettings size={16} />}
                      onClick={() => setProfileOpen(false)}
                      styles={{
                        root: {
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        },
                      }}
                    />
                    <NavLink
                      label="Sign out"
                      leftSection={<IconLogout size={16} />}
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      styles={{
                        root: {
                          fontSize: 13,
                          color: 'var(--red, #e03131)',
                        },
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Group>
          </Group>

          {!online && (
            <Box
              style={{
                background: 'var(--yellow, #f59f00)',
                color: '#fff',
                textAlign: 'center',
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              You&apos;re offline — viewing cached data. Logging is disabled.
            </Box>
          )}
          <Box
            className="main-content"
            style={{
              minHeight: '100vh',
              padding: `${rem(32)} ${rem(36)}`,
              maxWidth: 1160,
              margin: '0 auto',
            }}
          >
            {children}
          </Box>
        </AppShell.Main>
      </AppShell>
      <Box
        className="desktop-only"
        style={{
          position: 'fixed',
          bottom: rem(28),
          right: rem(18),
          zIndex: 200,
        }}
      >
        <ThemeSwitcher />
      </Box>
      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-bottom-nav mobile-only">
        <div className="mobile-nav-inner">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={`mobile-nav-item${active ? ' active' : ''}`}>
                <Icon size={22} stroke={active ? 2.5 : 1.5} />
                <span className="mobile-nav-label">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
