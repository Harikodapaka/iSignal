'use client';

import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { PushNotificationsCard } from './PushNotificationsCard';
import { MetricRemindersCard } from './MetricRemindersCard';
import { WebhookUrlsCard } from './WebhookUrlsCard';
import { SiriShortcutGuide } from './SiriShortcutGuide';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage voice logging and integrations" />

      <Stack gap="xl" mt="lg">
        <SectionLabel>Push Notifications</SectionLabel>
        <PushNotificationsCard />

        <SectionLabel>Metric Reminders</SectionLabel>
        <MetricRemindersCard />

        <SectionLabel>Voice Logging (Siri / Shortcuts)</SectionLabel>
        <WebhookUrlsCard />

        <SectionLabel>Siri Shortcut Setup</SectionLabel>
        <SiriShortcutGuide />
      </Stack>
    </>
  );
}
