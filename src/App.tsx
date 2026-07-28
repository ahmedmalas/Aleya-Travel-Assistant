import { AppShell } from './components/AppShell';
import { SupersededPreviewGate } from './components/SupersededPreviewGate';

export default function App() {
  return (
    <SupersededPreviewGate>
      <AppShell />
    </SupersededPreviewGate>
  );
}
