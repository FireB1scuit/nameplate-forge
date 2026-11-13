import { PHONE_QUERY, useHashSync, useLiveBuild, useMediaQuery } from './state/hooks';
import { DesktopLayout, PhoneLayout } from './ui/Layout';

export function App() {
  useLiveBuild();
  useHashSync();
  const phone = useMediaQuery(PHONE_QUERY);
  return phone ? <PhoneLayout /> : <DesktopLayout />;
}
