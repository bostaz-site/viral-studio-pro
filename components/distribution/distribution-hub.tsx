'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConnectAccounts } from './connect-accounts'
import { ScheduleQueue } from './schedule-queue'
import { ScheduleCalendar } from './schedule-calendar'
import { PublicationHistory } from './publication-history'
import { DistributionSettings } from './distribution-settings'
import { ScheduleDialog } from './schedule-dialog'
import { useScheduleStore } from '@/stores/schedule-store'

export function DistributionHub() {
  const { queue, fetchQueue } = useScheduleStore()
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Distribution Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your social accounts, schedule posts, and track publications
        </p>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <ScheduleQueue onAddClick={() => setScheduleOpen(true)} />
        </TabsContent>

        <TabsContent value="calendar">
          <ScheduleCalendar queue={queue} />
        </TabsContent>

        <TabsContent value="accounts">
          <ConnectAccounts />
        </TabsContent>

        <TabsContent value="history">
          <PublicationHistory queue={queue} />
        </TabsContent>

        <TabsContent value="settings">
          <DistributionSettings />
        </TabsContent>
      </Tabs>

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  )
}
