'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import TopBar from '@/components/ui/TopBar';
import RewardPopup from '@/components/ui/RewardPopup';
import CheckpointBottomOverlay from '@/components/game/CheckpointBottomOverlay';
import DoctorChatModal from '@/components/chat/DoctorChatModal';
import ProfileModal from '@/components/ui/ProfileModal';
import { useGameStore } from '@/stores/gameStore';
import { GAME_CONFIG } from '@/lib/gameConfig';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false });

function medicationDayFromDescription(description?: string): string | null {
  const match = String(description ?? '').match(/\bDay\s+(\d+)\s+of\b/i);
  return match ? match[1] : null;
}

function normalizedMedicationTitle(title?: string): string {
  return String(title ?? '').toLowerCase().replace(/\(\d+\/\d+\)$/g, '').replace(/\s+/g, ' ').trim();
}

function logicalChecklistKey(item: any): string {
  if (item.category !== 'medication') return String(item._id);
  const day = medicationDayFromDescription(item.description)
    ?? (item.unlockAt ? new Date(item.unlockAt).toISOString().slice(0, 10) : 'today');
  const slot = item.unlockAt
    ? String(new Date(item.unlockAt).getHours()).padStart(2, '0')
    : String(item.orderInGroup ?? 0);
  return `${normalizedMedicationTitle(item.title)}_${day}_${slot}`;
}

function mergeDuplicateChecklistItems<T extends { _id?: string; order?: number; isCompleted?: boolean; isFullyDone?: boolean; isLocked?: boolean; isAvailable?: boolean; remainingSeconds?: number }>(items: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const item of items) {
    const key = logicalChecklistKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, {
      ...existing,
      isCompleted: Boolean(existing.isCompleted || item.isCompleted),
      isFullyDone: Boolean(existing.isFullyDone || item.isFullyDone),
      isLocked: Boolean(existing.isLocked && item.isLocked),
      isAvailable: Boolean(existing.isAvailable || item.isAvailable),
      remainingSeconds: Math.min(existing.remainingSeconds ?? 0, item.remainingSeconds ?? 0),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    progress,
    checklist,
    mapSpec,
    currentMapInfo,
    consultations,
    completeItem,
    initFromStorage,
    loadProgress,
    loadChecklist,
    loadCurrentMap,
    loadMap,
    loadConsultationsWithMaps,
  } = useGameStore();

  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null);
  const [showDoctorChat, setShowDoctorChat] = useState(false);
  const [showConsultationSelector, setShowConsultationSelector] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [routeHudExpanded, setRouteHudExpanded] = useState(false);
  const [introMessage, setIntroMessage] = useState<string | undefined>(undefined);
  const [companionMessage, setCompanionMessage] = useState<string | undefined>(undefined);
  const [advanceKey, setAdvanceKey] = useState<string | undefined>(undefined);
  const [completingItemIds, setCompletingItemIds] = useState<Set<string>>(() => new Set());
  const completingItemIdsRef = useRef<Set<string>>(new Set());
  const previousCompletedRef = useRef<number | null>(null);
  const pendingAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initFromStorage();
    
    // Expose doctor chat function globally for GameCanvas
    (window as any).__openDoctorChat = () => {
      setShowDoctorChat(true);
    };
    (window as any).__openProfile = () => {
      setShowProfile(true);
    };
    
    return () => {
      delete (window as any).__openDoctorChat;
      delete (window as any).__openProfile;
    };
  }, []);

  // One-time intro per consultation (localStorage flag)
  useEffect(() => {
    if (!currentMapInfo?.consultationId) return;
    if (typeof window === 'undefined') return;
    const key = `euexia_intro_shown_${currentMapInfo.consultationId}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      setIntroMessage(
        "I’ll walk with you from the start. Let’s reach today’s first checkpoint together."
      );
    } else {
      setIntroMessage(undefined);
    }
  }, [currentMapInfo?.consultationId]);

  useEffect(() => {
    previousCompletedRef.current = null;
    if (pendingAdvanceTimeoutRef.current) clearTimeout(pendingAdvanceTimeoutRef.current);
    if (companionMessageTimeoutRef.current) clearTimeout(companionMessageTimeoutRef.current);
    setAdvanceKey(undefined);
    setCompanionMessage(undefined);
  }, [currentMapInfo?.consultationId]);

  useEffect(() => {
    if (companionMessageTimeoutRef.current) clearTimeout(companionMessageTimeoutRef.current);
    if (!companionMessage) return;

    companionMessageTimeoutRef.current = setTimeout(() => {
      setCompanionMessage(undefined);
      setAdvanceKey(undefined);
    }, 8000);

    return () => {
      if (companionMessageTimeoutRef.current) clearTimeout(companionMessageTimeoutRef.current);
    };
  }, [companionMessage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('euexia_token');
      if (!token) {
        router.push('/');
        return;
      }
    }
    if (isAuthenticated) {
      loadProgress();
      (async () => {
        await loadConsultationsWithMaps();
        // After loading consultations, try to load current map
        await loadCurrentMap();
        // If no current map after loading, auto-select first consultation if available
        const { consultations: loadedConsultations, currentMapInfo } = useGameStore.getState();
        if (loadedConsultations.length > 0 && !currentMapInfo) {
          // Auto-select first consultation if none selected
          const firstConsultation = loadedConsultations[0];
          if (firstConsultation.maps && firstConsultation.maps.length > 0) {
            await loadMap(firstConsultation._id, 0);
          } else if (firstConsultation._id) {
            await loadChecklist(firstConsultation._id);
          }
        }
      })();
    }
  }, [isAuthenticated]);

  // Get checklist items (events) for current consultation
  const currentConsultationId = currentMapInfo?.consultationId;
  const currentChecklist = useMemo(
    () => (
      currentConsultationId
        ? checklist.filter((i) => i.consultationId === currentConsultationId)
        : checklist
    ),
    [checklist, currentConsultationId]
  );
  const displayChecklist = useMemo(
    () => mergeDuplicateChecklistItems(currentChecklist),
    [currentChecklist]
  );

  // Group events by star: starGroupId is map grouping (typically day-level)
  const groupOrder = useMemo(() => {
    const groups: string[] = [];
    const sortedByOrder = [...displayChecklist].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const item of sortedByOrder) {
      const g = String(item.starGroupId ?? item.groupId ?? item._id ?? '');
      if (!groups.includes(g)) groups.push(g);
    }
    return groups;
  }, [displayChecklist]);

  // Events per star (all stars for this consultation)
  const eventsPerStarAll = useMemo(
    () => groupOrder.map((g) =>
      displayChecklist.filter((e) => String(e.starGroupId ?? e.groupId ?? e._id ?? '') === g)
    ),
    [displayChecklist, groupOrder]
  );

  // Current map shows stars [startStepIndex, endStepIndex]
  const startStepIndex = currentMapInfo?.startStepIndex ?? 0;
  const endStepIndex = currentMapInfo?.endStepIndex ?? Math.max(0, eventsPerStarAll.length - 1);
  const mapEventsPerStar = useMemo(
    () => eventsPerStarAll.slice(startStepIndex, endStepIndex + 1),
    [eventsPerStarAll, startStepIndex, endStepIndex]
  );

  const completedCount = useMemo(
    () => mapEventsPerStar.filter(
      (star) => star.length > 0 && star.every((e) => e.isCompleted || e.isFullyDone)
    ).length,
    [mapEventsPerStar]
  );
  const totalCount = mapEventsPerStar.length;
  const mapChecklist = useMemo(() => mapEventsPerStar.flat(), [mapEventsPerStar]);
  const currentTheme = progress?.currentTheme || 'desert';
  const themeInfo = GAME_CONFIG.themeColors[currentTheme];

  // Get current consultation info
  const currentConsultation = consultations.find(
    (c) => c._id === currentMapInfo?.consultationId
  );

  // Get all maps for current consultation
  const currentMaps = currentConsultation?.maps || [];
  const currentMapIndex = currentMapInfo?.mapIndex ?? 0;
  const hasNextMap = currentMapIndex < currentMaps.length - 1;
  const hasPrevMap = currentMapIndex > 0;

  // If no current consultation or no maps, show consultation selector
  const needsConsultationSelection = !currentMapInfo || consultations.length === 0 || (consultations.length > 0 && !currentConsultation);

  useEffect(() => {
    if (!currentMapInfo?.consultationId) return;
    const previousCompleted = previousCompletedRef.current;
    if (previousCompleted === null) {
      previousCompletedRef.current = completedCount;
      return;
    }

    if (completedCount > previousCompleted && completedCount > 0 && completedCount < totalCount) {
      if (selectedCheckpoint === null) {
        setCompanionMessage(`Great work finishing Day ${completedCount}. Let’s walk to Day ${completedCount + 1} together.`);
        setAdvanceKey(`${currentMapInfo.consultationId}:${previousCompleted}:${completedCount}`);
      }
    }
    previousCompletedRef.current = completedCount;
  }, [completedCount, currentMapInfo?.consultationId, selectedCheckpoint, totalCount]);

  const handleSelectConsultation = async (consultationId: string) => {
    await loadMap(consultationId, 0);
    await loadChecklist(consultationId);
    setShowConsultationSelector(false);
  };

  const handleNextMap = () => {
    if (currentMapInfo && hasNextMap) {
      loadMap(currentMapInfo.consultationId, currentMapIndex + 1);
    }
  };

  const handlePrevMap = () => {
    if (currentMapInfo && hasPrevMap) {
      loadMap(currentMapInfo.consultationId, currentMapIndex - 1);
    }
  };

  const handleCheckpointClick = useCallback((index: number) => {
    setSelectedCheckpoint(index);
  }, []);

  const handleCloseModal = () => {
    setSelectedCheckpoint(null);
  };

  const handleCompleteTask = async (itemId: string) => {
    if (completingItemIdsRef.current.has(itemId)) return;
    const checkpointIndex = selectedCheckpoint;
    const eventsBefore = checkpointIndex !== null ? mapEventsPerStar[checkpointIndex] ?? [] : [];
    const wasCheckpointDone = eventsBefore.length > 0 && eventsBefore.every((e) => e.isCompleted || e.isFullyDone);
    completingItemIdsRef.current.add(itemId);
    setCompletingItemIds((current) => new Set(current).add(itemId));

    try {
      const reward = await completeItem(itemId);
      if (!reward) return;

      if (
        checkpointIndex !== null &&
        !wasCheckpointDone &&
        checkpointIndex === completedCount &&
        completedCount < totalCount - 1
      ) {
        const latestChecklist = useGameStore.getState().checklist;
        const latestCurrentChecklist = currentConsultationId
          ? latestChecklist.filter((i) => i.consultationId === currentConsultationId)
          : latestChecklist;
        const latestDisplayChecklist = mergeDuplicateChecklistItems(latestCurrentChecklist);
        const latestGroupOrder: string[] = [];
        [...latestDisplayChecklist]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((item) => {
            const g = String(item.starGroupId ?? item.groupId ?? item._id ?? '');
            if (!latestGroupOrder.includes(g)) latestGroupOrder.push(g);
          });
        const latestMapGroups = latestGroupOrder
          .map((g) => latestDisplayChecklist.filter((e) => String(e.starGroupId ?? e.groupId ?? e._id ?? '') === g))
          .slice(startStepIndex, endStepIndex + 1);
        const latestEventsAtCheckpoint = latestMapGroups[checkpointIndex] ?? [];
        const isCheckpointDone =
          latestEventsAtCheckpoint.length > 0 &&
          latestEventsAtCheckpoint.every((e) => e.isCompleted || e.isFullyDone);

        if (isCheckpointDone) {
          previousCompletedRef.current = checkpointIndex + 1;
          setSelectedCheckpoint(null);
          if (pendingAdvanceTimeoutRef.current) clearTimeout(pendingAdvanceTimeoutRef.current);
          pendingAdvanceTimeoutRef.current = setTimeout(() => {
            setCompanionMessage(`Great work finishing Day ${checkpointIndex + 1}. Let’s walk to Day ${checkpointIndex + 2} together.`);
            setAdvanceKey(`${currentConsultationId}:${checkpointIndex}:${checkpointIndex + 1}:${Date.now()}`);
          }, 650);
        }
      }
    } finally {
      setCompletingItemIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        completingItemIdsRef.current.delete(itemId);
        return next;
      });
    }
  };

  const handleCompanionMessageDone = useCallback(() => {
    if (companionMessageTimeoutRef.current) clearTimeout(companionMessageTimeoutRef.current);
    setCompanionMessage(undefined);
    setAdvanceKey(undefined);
  }, []);

  // Selected star's events (for overlay: list of events at this star)
  const selectedStarEventsRaw = selectedCheckpoint !== null
    ? (mapEventsPerStar[selectedCheckpoint] ?? [])
    : [];
  const selectedHasAvailable = selectedStarEventsRaw.some((e) => !e.isCompleted && !e.isLocked && !e.isExpired);
  // Unlocked star: show only completable tasks. Locked star: show only not-completable tasks.
  const selectedStarEvents = selectedHasAvailable
    ? selectedStarEventsRaw.filter((e) => !e.isCompleted && !e.isLocked && !e.isExpired)
    : selectedStarEventsRaw.filter((e) => !e.isCompleted && (e.isLocked || e.isExpired));

  return (
    <div className="app-screen h-screen pb-[5rem] pt-[4.35rem] flex flex-col overflow-hidden">
      <TopBar />
      <RewardPopup />

      <div className="w-full flex-1 min-h-0 flex flex-col">
        {/* Game Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 relative overflow-hidden"
        >
          <GameCanvas
            theme={currentTheme}
            completedCount={completedCount}
            totalCount={Math.max(totalCount, mapEventsPerStar.length)}
            mapSpec={mapSpec}
            checklistItems={mapChecklist}
            eventsPerStar={mapEventsPerStar}
            onCheckpointClick={handleCheckpointClick}
            userName={user?.name}
            playerCharacterId={progress?.selectedCharacter}
            introMessage={introMessage}
            companionMessage={companionMessage}
            advanceKey={advanceKey}
            onCompanionMessageDone={handleCompanionMessageDone}
          />

          {/* In-map route drawer */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-3 left-2 right-2 z-20 pointer-events-none sm:left-3 sm:right-3"
          >
            <div className="pointer-events-auto mx-auto max-w-lg overflow-hidden rounded-[1.4rem] border border-blue-200/70 bg-white/90 px-3 py-2 shadow-2xl shadow-blue-900/10 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setRouteHudExpanded((value) => !value)}
                className="flex w-full items-center gap-2.5 text-left"
                aria-expanded={routeHudExpanded}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] bg-gradient-to-br from-teal-300 to-cyan-400 text-xs font-black text-[#0b1f58] shadow-lg shadow-cyan-500/20">
                  {completedCount}/{totalCount}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-teal-700">
                    <span className="truncate">{themeInfo?.emoji || '🗺️'} Quest Map</span>
                    {currentMapInfo && currentMaps.length > 1 && (
                      <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-blue-700">
                        {currentMapIndex + 1}/{currentMaps.length}
                      </span>
                    )}
                  </div>
                  <div className="block truncate text-sm font-black leading-tight text-[#0b1f58] sm:text-base">
                    {currentConsultation?.title || currentMapInfo?.consultationTitle || 'My Consultation'}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-300 to-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-slate-600">
                      {totalCount - completedCount > 0
                        ? `${totalCount - completedCount} left`
                        : 'Complete'}
                    </span>
                  </div>
                </div>

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[1rem] border border-blue-100 bg-blue-50 text-blue-700">
                  {routeHudExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </span>
              </button>

              {routeHudExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 overflow-hidden border-t border-blue-100 pt-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">
                      {totalCount - completedCount > 0
                        ? `${totalCount - completedCount} quests left on this route`
                        : 'Route complete. Claim your momentum!'}
                    </p>
                    {consultations.length > 1 && (
                      <button
                        onClick={() => setShowConsultationSelector(true)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] border border-blue-100 bg-blue-50 text-blue-700 shadow-lg transition hover:bg-cyan-100"
                        title="Switch consultation"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {currentMapInfo && currentMaps.length > 1 && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={handlePrevMap}
                        disabled={!hasPrevMap}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back
                      </button>
                      <button
                        onClick={handleNextMap}
                        disabled={!hasNextMap}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>

          {consultations.length > 1 && !routeHudExpanded && (
            <div className="absolute left-3 top-3 z-20">
              <button
                onClick={() => setShowConsultationSelector(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] border border-blue-200/70 bg-white/90 text-blue-700 shadow-lg shadow-blue-900/10 backdrop-blur-xl transition hover:bg-cyan-50"
                title="Switch consultation"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Consultation Selector Overlay */}
          {showConsultationSelector && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="game-card max-w-md w-full max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Select Consultation</h3>
                  <button
                    onClick={() => setShowConsultationSelector(false)}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  {consultations.map((consultation) => {
                    const isSelected = consultation._id === currentMapInfo?.consultationId;
                    const mapCount = consultation.maps?.length || 0;
                    return (
                      <button
                        key={consultation._id}
                        onClick={() => handleSelectConsultation(consultation._id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-600/30 border-2 border-blue-500'
                            : 'bg-gray-700/50 hover:bg-gray-700/70 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-white">{consultation.title}</h4>
                            <p className="text-sm text-gray-400 mt-1">
                              {mapCount > 0 && `${mapCount} ${mapCount === 1 ? 'map' : 'maps'}`}
                              {consultation.status === 'completed' ? ' • Ready' : ' • Processing...'}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="text-blue-400">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => router.push('/consultations')}
                  className="w-full mt-4 btn-game py-2 text-sm"
                >
                  View All Consultations
                </button>
              </motion.div>
            </div>
          )}

          {/* No Consultation Selected State */}
          {needsConsultationSelection && !showConsultationSelector && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="game-card max-w-md w-full mx-4 text-center"
              >
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-bold text-white mb-2">No Consultation Selected</h3>
                <p className="text-gray-400 mb-6">
                  {consultations.length === 0
                    ? 'Create your first consultation to see your map'
                    : 'Select a consultation to view its map and checklist'}
                </p>
                <div className="space-y-2">
                  {consultations.length > 0 ? (
                    <>
                      <button
                        onClick={() => setShowConsultationSelector(true)}
                        className="w-full btn-game py-3"
                      >
                        Select Consultation
                      </button>
                      <button
                        onClick={() => router.push('/consultations')}
                        className="w-full btn-game-secondary py-3"
                      >
                        View All Consultations
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => router.push('/upload')}
                      className="w-full btn-game py-3"
                    >
                      Create Your First Consultation
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
      {/* Checkpoint Bottom Overlay: list of events at selected star */}
      <CheckpointBottomOverlay
        isOpen={selectedCheckpoint !== null && selectedStarEvents.length > 0}
        onClose={handleCloseModal}
        items={selectedStarEvents}
        checkpointNumber={(selectedCheckpoint ?? 0) + 1}
        onComplete={handleCompleteTask}
        completingItemIds={completingItemIds}
      />

      <DoctorChatModal
        isOpen={showDoctorChat}
        consultationId={currentConsultationId}
        onClose={() => setShowDoctorChat(false)}
      />

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
