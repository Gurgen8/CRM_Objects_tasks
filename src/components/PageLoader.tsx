import { Center, Loader } from '@mantine/core';

export function PageLoader({ fullscreen = true }: { fullscreen?: boolean }) {
  return (
    <Center h={fullscreen ? '100vh' : 240}>
      <Loader />
    </Center>
  );
}
