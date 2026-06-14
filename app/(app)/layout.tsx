export const dynamic = 'force-dynamic'

import { CollectionProvider } from '@/components/CollectionContext'
import { AppShell } from '@/components/layout/AppShell'
import { WebSheetProvider } from '@/components/ui/WebSheet'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CollectionProvider>
      <WebSheetProvider>
        <AppShell>{children}</AppShell>
      </WebSheetProvider>
    </CollectionProvider>
  )
}
