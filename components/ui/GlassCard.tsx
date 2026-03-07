import { Card, type CardProps } from '@mantine/core';

interface GlassCardProps extends Omit<CardProps, 'style'> {
  children: React.ReactNode;
  accentColor?: string;
  style?: React.CSSProperties;
}

export function GlassCard({ children, accentColor, style, p = 'lg', ...rest }: GlassCardProps) {
  return (
    <Card
      p={p}
      radius="xl"
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${accentColor ? `${accentColor}30` : 'var(--card-border)'}`,
        boxShadow: 'var(--card-shadow)',
        ...(accentColor ? { borderTop: `2px solid ${accentColor}` } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
}
