'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';

interface Consultation {
  _id: string;
  title: string;
  status: string;
  createdAt: string;
  maps?: Array<{
    _id: string;
    mapIndex: number;
    startStepIndex: number;
    endStepIndex: number;
  }>;
  totalSteps?: number;
}

export default function ConsultationsList() {
  const router = useRouter();
  const { consultations, loadConsultationsWithMaps, loadMap, loadChecklist, deleteConsultation } = useGameStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadConsultationsWithMaps();
  }, [loadConsultationsWithMaps]);

  const handleSelectConsultation = async (consultation: Consultation) => {
    // Don't navigate if we're in delete-confirm mode
    if (confirmDeleteId) return;

    // Load the first map of this consultation
    if (consultation.maps && consultation.maps.length > 0) {
      await loadMap(consultation._id, 0);
      await loadChecklist(consultation._id);
      router.push('/dashboard');
    } else {
      // If no maps, just load checklist and go to dashboard
      await loadChecklist(consultation._id);
      router.push('/dashboard');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, consultationId: string) => {
    e.stopPropagation(); // Don't trigger card click
    setConfirmDeleteId(consultationId);
  };

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    const success = await deleteConsultation(confirmDeleteId);
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (!success) {
      alert('Failed to delete consultation. Please try again.');
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen pb-20 pt-14 bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-white mb-2">My Consultations</h1>
          <p className="text-gray-400 text-sm">Select a consultation to view its map and checklist</p>
        </motion.div>

        {consultations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-gray-400 mb-6">No consultations yet</p>
            <button
              onClick={() => router.push('/upload')}
              className="btn-game px-6 py-3"
            >
              Create Your First Consultation
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {consultations.map((consultation, index) => {
                const mapCount = consultation.maps?.length || 0;
                const totalSteps = consultation.totalSteps || 0;
                const isCompleted = consultation.status === 'completed';
                const isDeleting = deletingId === consultation._id;
                const isConfirming = confirmDeleteId === consultation._id;

                return (
                  <motion.div
                    key={consultation._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: isDeleting ? 0.5 : 1, y: 0 }}
                    exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectConsultation(consultation)}
                    className={`game-card p-4 cursor-pointer hover:scale-[1.02] transition-transform relative ${
                      isDeleting ? 'pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white truncate">
                            {consultation.title}
                          </h3>
                          {isCompleted ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300 border border-green-500/30 whitespace-nowrap">
                              ✓ Ready
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 whitespace-nowrap">
                              Processing...
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-2">
                          {formatDate(consultation.createdAt)}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-300">
                          {mapCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span>🗺️</span>
                              {mapCount} {mapCount === 1 ? 'map' : 'maps'}
                            </span>
                          )}
                          {totalSteps > 0 && (
                            <span className="flex items-center gap-1">
                              <span>✅</span>
                              {totalSteps} {totalSteps === 1 ? 'task' : 'tasks'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Delete / Confirm buttons */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={handleConfirmDelete}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-600/80 text-gray-200 hover:bg-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteClick(e, consultation._id)}
                            className="p-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                            title="Delete consultation"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}

                        {/* Arrow icon (hidden during confirm) */}
                        {!isConfirming && (
                          <div className="text-gray-400">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Deleting spinner overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 rounded-xl">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                          className="text-2xl"
                        >
                          🗑️
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={() => router.push('/upload')}
            className="w-full btn-game py-3"
          >
            + Create New Consultation
          </button>
        </motion.div>
      </div>
    </div>
  );
}
