import { Box, Group, Text, Title } from '@mantine/core';
import { formatPageDate } from '@/utils/date';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" mb="xl" className="fade-in">
      <Box>
        <Title
          order={1}
          className="page-title"
          style={{
            letterSpacing: '-0.045em',
            fontSize: 32,
            lineHeight: 1,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </Title>
        <Text size="sm" mt={5} style={{ color: 'var(--text-muted)' }}>
          {subtitle ?? formatPageDate()}
        </Text>
      </Box>
      {actions && <Box>{actions}</Box>}
    </Group>
  );
}
