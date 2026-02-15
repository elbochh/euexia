'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
import VoiceRecorder from '@/components/upload/VoiceRecorder';
import ImageUploader from '@/components/upload/ImageUploader';
import TextInput from '@/components/upload/TextInput';
import PdfUploader from '@/components/upload/PdfUploader';
import { uploadApi } from '@/lib/api';
import { useGameStore } from '@/stores/gameStore';

type UploadType = 'voice' | 'image' | 'text' | 'pdf';

interface PendingUpload {
  type: UploadType;
  data: any;
  fileUrl?: string;
  rawText?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const { isAuthenticated, initFromStorage, loadChecklist, loadProgress, loadConsultationsWithMaps } = useGameStore();
  const [step, setStep] = useState<'select' | 'input' | 'processing' | 'done'>('select');
  const [selectedTypes, setSelectedTypes] = useState<Set<UploadType>>(new Set());
  const [currentType, setCurrentType] = useState<UploadType | null>(null);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [title, setTitle] = useState('My Consultation');
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('euexia_token')) {
      router.push('/');
    }
  }, []);

  const uploadTypes = [
    { type: 'voice' as UploadType, icon: '🎤', label: 'Voice', desc: 'Record consultation' },
    { type: 'image' as UploadType, icon: '📷', label: 'Image', desc: 'Photo of reports' },
    { type: 'text' as UploadType, icon: '📝', label: 'Text', desc: 'Type your notes' },
    { type: 'pdf' as UploadType, icon: '📄', label: 'PDF', desc: 'Upload documents' },
  ];

  const toggleType = (type: UploadType) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTypes(newSet);
  };

  const handleStartInput = () => {
    if (selectedTypes.size === 0) return;
    setCurrentType(Array.from(selectedTypes)[0]);
    setStep('input');
  };

  const addUpload = (upload: PendingUpload) => {
    setUploads((prev) => [...prev.filter((u) => u.type !== upload.type), upload]);
    // Move to next type or done
    const types = Array.from(selectedTypes);
    const currentIndex = types.indexOf(upload.type);
    if (currentIndex < types.length - 1) {
      setCurrentType(types[currentIndex + 1]);
    }
  };

  const handleProcess = async () => {
    setStep('processing');
    setProcessing(true);

    try {
      // Upload files first
      setProcessingStep('Uploading files...');
      const processedUploads = [];

      for (const upload of uploads) {
        if (upload.type === 'text') {
          processedUploads.push({
            type: 'text',
            rawText: upload.rawText || upload.data,
          });
        } else if (upload.data instanceof Blob || upload.data instanceof File) {
          setProcessingStep(`Uploading ${upload.type}...`);
          try {
            const file =
              upload.data instanceof File
                ? upload.data
                : new File([upload.data], `recording.webm`, { type: upload.data.type });
            const res = await uploadApi.uploadFile(file);
            processedUploads.push({
              type: upload.type,
              fileUrl: res.data.fileBase64,
              rawText: '',
            });
          } catch {
            processedUploads.push({
              type: upload.type,
              fileUrl: '',
              rawText: '',
            });
          }
        }
      }

      // Process through AI pipeline
      setProcessingStep('AI is analyzing your consultation...');
      await new Promise((r) => setTimeout(r, 1000)); // UX delay

      setProcessingStep('Generating medical summary...');
      await new Promise((r) => setTimeout(r, 800));

      setProcessingStep('Creating your health checklist...');
      const result = await uploadApi.createConsultation({
        title,
        uploads: processedUploads,
      });

      setProcessingStep('Done! Your quests are ready!');
      await new Promise((r) => setTimeout(r, 500));

      // Reload checklist, progress, and consultations
      await loadChecklist();
      await loadProgress();
      await loadConsultationsWithMaps();

      setStep('done');
      
      // Redirect to consultations page after a short delay
      setTimeout(() => {
        router.push('/consultations');
      }, 1500);
    } catch (error) {
      console.error('Processing failed:', error);
      setProcessingStep('Processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-14">
      <TopBar />

      <div className="max-w-lg mx-auto px-3 mt-2">
        <AnimatePresence mode="wait">
          {/* Step 1: Select upload types */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">📋</div>
                <h2 className="text-xl font-bold">New Consultation</h2>
                <p className="text-gray-400 text-sm mt-1">
                  What would you like to upload?
                </p>
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Consultation title"
                className="w-full px-4 py-3 rounded-xl bg-game-panel border border-blue-500/30
                  text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60
                  mb-4 text-sm"
              />

              <div className="grid grid-cols-2 gap-3 mb-6">
                {uploadTypes.map((ut) => (
                  <motion.button
                    key={ut.type}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleType(ut.type)}
                    className={`game-card text-center py-5 transition-all ${
                      selectedTypes.has(ut.type)
                        ? 'border-green-500/50 bg-green-500/10'
                        : ''
                    }`}
                  >
                    <div className="text-3xl mb-2">{ut.icon}</div>
                    <div className="text-sm font-bold">{ut.label}</div>
                    <div className="text-[10px] text-gray-500">{ut.desc}</div>
                    {selectedTypes.has(ut.type) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full
                          flex items-center justify-center text-white text-xs"
                      >
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              <button
                onClick={handleStartInput}
                disabled={selectedTypes.size === 0}
                className="btn-game w-full disabled:opacity-50"
              >
                Continue ({selectedTypes.size} selected)
              </button>
            </motion.div>
          )}

          {/* Step 2: Input for each selected type */}
          {step === 'input' && currentType && (
            <motion.div
              key={`input-${currentType}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
            >
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setStep('select')}
                  className="text-gray-400 text-sm"
                >
                  ← Back
                </button>
                <div className="flex gap-1">
                  {Array.from(selectedTypes).map((t) => (
                    <div
                      key={t}
                      className={`w-2 h-2 rounded-full ${
                        t === currentType
                          ? 'bg-blue-400'
                          : uploads.find((u) => u.type === t)
                            ? 'bg-green-400'
                            : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {currentType === 'voice' && (
                <VoiceRecorder
                  onRecorded={(blob) => addUpload({ type: 'voice', data: blob })}
                />
              )}
              {currentType === 'image' && (
                <ImageUploader
                  onImageSelected={(file) =>
                    addUpload({ type: 'image', data: file })
                  }
                />
              )}
              {currentType === 'text' && (
                <TextInput
                  onTextSubmit={(text) =>
                    addUpload({ type: 'text', data: text, rawText: text })
                  }
                />
              )}
              {currentType === 'pdf' && (
                <PdfUploader
                  onPdfSelected={(file) => addUpload({ type: 'pdf', data: file })}
                />
              )}

              <div className="mt-4 flex gap-3">
                {Array.from(selectedTypes).indexOf(currentType) > 0 && (
                  <button
                    onClick={() => {
                      const types = Array.from(selectedTypes);
                      const idx = types.indexOf(currentType);
                      setCurrentType(types[idx - 1]);
                    }}
                    className="btn-game-secondary flex-1"
                  >
                    Previous
                  </button>
                )}
                <button
                  onClick={() => {
                    const types = Array.from(selectedTypes);
                    const idx = types.indexOf(currentType);
                    if (idx < types.length - 1) {
                      setCurrentType(types[idx + 1]);
                    }
                  }}
                  className="btn-game-secondary flex-1"
                  style={{
                    display:
                      Array.from(selectedTypes).indexOf(currentType) <
                      selectedTypes.size - 1
                        ? 'block'
                        : 'none',
                  }}
                >
                  Next
                </button>
              </div>

              {uploads.length >= selectedTypes.size && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                  <button onClick={handleProcess} className="btn-game w-full text-lg">
                    🤖 Process with AI
                  </button>
                </motion.div>
              )}

              {uploads.length > 0 && uploads.length < selectedTypes.size && (
                <p className="text-center text-gray-500 text-xs mt-3">
                  {uploads.length}/{selectedTypes.size} items ready
                </p>
              )}
            </motion.div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  rotate: { repeat: Infinity, duration: 2, ease: 'linear' },
                  scale: { repeat: Infinity, duration: 1.5 },
                }}
                className="text-6xl mb-6 inline-block"
              >
                🤖
              </motion.div>
              <h2 className="text-xl font-bold mb-2">Processing...</h2>
              <motion.p
                key={processingStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-blue-300 text-sm"
              >
                {processingStep}
              </motion.p>

              <div className="mt-8 flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      delay: i * 0.3,
                    }}
                    className="w-3 h-3 rounded-full bg-blue-500"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-7xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Quest Board Updated!</h2>
              <p className="text-gray-400 text-sm mb-8">
                Your AI-powered health checklist is ready. Complete your quests
                to earn XP and climb the leaderboard!
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push('/checklist')}
                  className="btn-game w-full text-lg"
                >
                  ⚔️ View My Quests
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn-game-secondary w-full"
                >
                  🗺️ Back to Map
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}

