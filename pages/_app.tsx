/**
 * Custom _app – wraps all pages with AuthProvider so useAuth() is available
 * everywhere. Also installs the tRPC + React Query provider.
 */

import type { AppProps } from "next/app";
import { AuthProvider } from "@/client/hooks/useAuth";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
