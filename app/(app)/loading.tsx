import { Box, Loader } from '@mantine/core';
import Image from 'next/image';

export default function Loading() {
  return (
    <Box
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Image src="/logo.png" alt="iSignal" width={60} height={60} style={{ opacity: 0.75 }} />
      <Loader color="orange" size="sm" type="dots" />
    </Box>
  );
}
