import { Text } from '@mantine/core'

export function SectionLabel({ children, mt }: { children: React.ReactNode; mt?: string | number }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" mb="sm" mt={mt}
      style={{ letterSpacing: '0.09em', color: 'var(--text-muted)' }}>
      {children}
    </Text>
  )
}
