import { Box, Loader } from '@mantine/core';
import Image from 'next/image';

export default function Loading() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Image src="/logo.png" alt="iSignal" width={72} height={72} style={{ opacity: 0.85 }} />
      <Loader color="orange" size="sm" type="dots" />
    </Box>
  );
}
