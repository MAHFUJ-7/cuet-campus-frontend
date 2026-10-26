// CR Center — modern dashboard for class representatives.
// Self-contained: scope overview, quick declaration actions, permanent routine
// edits, conflict checking and declaration history. The PDF upload / feed
// bridge were intentionally removed; notices are composed from here and the
// routine PDF is bundled with the app.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageShell } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { CrActionsGrid, CrDeclarationsSection, CrScopeHero } from './CrShared.jsx';
import {
  ClassChangeDialog,
  DeclareAutoDialog,
  DeclareMidBreakDialog,
  ExtraClassDialog,
} from './CrDialogs.jsx';
import PermanentRoutineDialog from './PermanentRoutineDialog.jsx';
import { useCrCenter } from './useCrCenter.js';

const DIALOG_ACTIONS = new Set([
  'auto',
  'mid_break',
  'class_cancellation',
  'room_change',
  'time_change',
  'extra_class',
  'permanent_routine',
]);

export default function CrDashboardPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;
  const controller = useCrCenter(profile);
  const [flow, setFlow] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const isClassChange =
    flow === 'class_cancellation' || flow === 'room_change' || flow === 'time_change';

  const handleAction = (kind) => {
    if (kind === 'announcement') {
      navigate('/cr/compose');
      return;
    }
    if (kind === 'conflicts') {
      navigate('/routine/conflicts');
      return;
    }
    if (DIALOG_ACTIONS.has(kind)) setFlow(kind);
  };

  const closeFlow = () => setFlow(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await controller.loadDeclarations();
    } finally {
      setRefreshing(false);
    }
  };

  const stats = [
    { label: 'Active', value: controller.approvedCount, icon: 'verified' },
    { label: 'Pending', value: controller.pendingCount, icon: 'schedule' },
    { label: 'Day-offs', value: controller.dayOffCount, icon: 'event_repeat' },
    { label: 'Breaks', value: controller.midBreakCount, icon: 'beach_access' },
  ];

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="CR Center"
        subtitle="Declarations, class changes and notices for your section."
      />

      <CrScopeHero
        profile={profile}
        sectionLabel={controller.resolvedSectionLabel}
        stats={stats}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-title-lg font-bold text-ink">Quick actions</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            Published instantly to your section, then synced with the server.
          </p>
        </div>
        <CrActionsGrid onAction={handleAction} />
      </section>

      <section className="mt-6">
        <CrDeclarationsSection
          title="My Declarations"
          controller={controller}
          onWithdrawLocal={(localId) => controller.withdrawLocal(localId)}
        />
      </section>

      {flow === 'auto' && (
        <DeclareAutoDialog
          open
          onClose={closeFlow}
          controller={controller}
          profile={profile}
        />
      )}
      {flow === 'mid_break' && (
        <DeclareMidBreakDialog
          open
          onClose={closeFlow}
          controller={controller}
          profile={profile}
        />
      )}
      {isClassChange && (
        <ClassChangeDialog
          open
          changeType={flow}
          onClose={closeFlow}
          controller={controller}
          profile={profile}
        />
      )}
      {flow === 'extra_class' && (
        <ExtraClassDialog
          open
          onClose={closeFlow}
          controller={controller}
          profile={profile}
        />
      )}
      {flow === 'permanent_routine' && (
        <PermanentRoutineDialog
          open
          onClose={closeFlow}
          profile={profile}
          section={profile?.section}
        />
      )}
    </PageShell>
  );
}
