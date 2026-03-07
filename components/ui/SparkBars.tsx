import { Box, Group } from '@mantine/core';

interface SparkBarsProps {
  data: { value: number | boolean | null }[];
  color: string;
  height?: number;
}

export function SparkBars({ data, color, height = 32 }: SparkBarsProps) {
  const numVals = data.map((d) => (typeof d.value === 'boolean' ? (d.value ? 1 : 0) : (d.value ?? 0)));
  const max = Math.max(...numVals, 1);

  return (
    <Group gap={3} align="flex-end" style={{ height, marginTop: 10 }}>
      {data.map((d, i) => {
        const pct = d.value === null ? 0 : Math.max((numVals[i] / max) * 100, 10);
        const isToday = i === data.length - 1;
        return (
          <Box
            key={i}
            style={{
              flex: 1,
              height: d.value === null ? 2 : `${pct}%`,
              background: isToday ? color : d.value !== null ? `${color}44` : 'var(--sep)',
              borderRadius: 3,
              transition: 'height 0.5s cubic-bezier(.4,0,.2,1)',
            }}
          />
        );
      })}
    </Group>
  );
}
