import { CollectionProvider } from '@/components/CollectionContext'
import { AppShell } from '@/components/layout/AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CollectionProvider>
      <AppShell>{children}</AppShell>
    </CollectionProvider>
  )
}
