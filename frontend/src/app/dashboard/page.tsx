'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
import RewardPopup from '@/components/ui/RewardPopup';
import CheckpointBottomOverlay from '@/components/game/CheckpointBottomOverlay';
import DoctorChatModal from '@/components/chat/DoctorChatModal';
import { useGameStore } from '@/stores/gameStore';
import { GAME_CONFIG } from '@/lib/gameConfig';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false });

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

  useEffect(() => {
    initFromStorage();
    
    // Expose doctor chat function globally for GameCanvas
    (window as any).__openDoctorChat = () => {
      setShowDoctorChat(true);
    };
    
    return () => {
      delete (window as any).__openDoctorChat;
    };
  }, []);

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
  const currentChecklist = currentConsultationId
    ? checklist.filter((i) => i.consultationId === currentConsultationId)
    : checklist;

  // Group events by star: starGroupId is map grouping (typically day-level)
  const groupOrder: string[] = [];
  const sortedByOrder = [...currentChecklist].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const item of sortedByOrder) {
    const g = String(item.starGroupId ?? item.groupId ?? item._id ?? '');
    if (!groupOrder.includes(g)) groupOrder.push(g);
  }
  // Events per star (all stars for this consultation)
  const eventsPerStarAll: typeof currentChecklist[] = groupOrder.map((g) =>
    currentChecklist.filter((e) => String(e.starGroupId ?? e.groupId ?? e._id ?? '') === g)
  );

  // Current map shows stars [startStepIndex, endStepIndex]
  const startStepIndex = currentMapInfo?.startStepIndex ?? 0;
  const endStepIndex = currentMapInfo?.endStepIndex ?? Math.max(0, eventsPerStarAll.length - 1);
  const mapEventsPerStar = eventsPerStarAll.slice(startStepIndex, endStepIndex + 1);

  const completedCount = mapEventsPerStar.filter((star) => star.some((e) => e.isCompleted)).length;
  const totalCount = mapEventsPerStar.length;
  const mapChecklist = mapEventsPerStar.flat();
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

  const handleCheckpointClick = (index: number) => {
    setSelectedCheckpoint(index);
  };

  const handleCloseModal = () => {
    setSelectedCheckpoint(null);
  };

  const handleCompleteTask = async (itemId: string) => {
    await completeItem(itemId);
    // Modal will close automatically after completion
  };

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
    <div className="h-screen pb-20 pt-14 flex flex-col overflow-hidden">
      <TopBar />
      <RewardPopup />

      <div className="w-full flex-1 min-h-0 flex flex-col">
        {/* Game Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-h-0 relative"
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
          />

          {/* In-map HUD (minimal, top-left, no container) */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-3 z-10 pointer-events-none"
          >
            <div className="text-[10px] font-semibold text-blue-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {themeInfo?.emoji || '🗺️'} QUEST MAP
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {currentConsultation?.title || currentMapInfo?.consultationTitle || 'My Consultation'}
              </h2>
              {consultations.length > 1 && (
                <button
                  onClick={() => setShowConsultationSelector(true)}
                  className="px-1.5 py-0.5 text-[9px] font-semibold rounded text-white bg-blue-600/70 hover:bg-blue-600/90 pointer-events-auto"
                  title="Switch consultation"
                >
                  ↻
                </button>
              )}
            </div>
            <p className="text-[11px] text-blue-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {completedCount}/{totalCount} quests
              {currentMapInfo && currentMaps.length > 1 && ` • Map ${currentMapIndex + 1}/${currentMaps.length}`}
            </p>
            {currentMapInfo && currentMaps.length > 1 && (
              <div className="flex items-center gap-1.5 mt-1.5 pointer-events-auto">
                <button
                  onClick={handlePrevMap}
                  disabled={!hasPrevMap}
                  className="px-2 py-1 text-[10px] font-semibold rounded text-white bg-blue-600/70 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Back
                </button>
                <button
                  onClick={handleNextMap}
                  disabled={!hasNextMap}
                  className="px-2 py-1 text-[10px] font-semibold rounded text-white bg-blue-600/70 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </motion.div>

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

      <BottomNav />

      {/* Checkpoint Bottom Overlay: list of events at selected star */}
      <CheckpointBottomOverlay
        isOpen={selectedCheckpoint !== null && selectedStarEvents.length > 0}
        onClose={handleCloseModal}
        items={selectedStarEvents}
        checkpointNumber={(selectedCheckpoint ?? 0) + 1}
        onComplete={handleCompleteTask}
      />

      <DoctorChatModal
        isOpen={showDoctorChat}
        consultationId={currentConsultationId}
        onClose={() => setShowDoctorChat(false)}
      />
    </div>
  );
}

