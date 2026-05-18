import type React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div>{children}</div>;
}
