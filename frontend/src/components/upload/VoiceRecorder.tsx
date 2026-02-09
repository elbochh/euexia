'use client';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface VoiceRecorderProps {
  onRecorded: (blob: Blob) => void;
}

export default function VoiceRecorder({ onRecorded }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded(blob);
        setHasRecording(true);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      intervalRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to record.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-card text-center">
      <div className="text-4xl mb-3">🎤</div>
      <h3 className="text-lg font-bold mb-2">Voice Recording</h3>
      <p className="text-gray-400 text-sm mb-4">
        Record your consultation summary or doctor&apos;s instructions
      </p>

      {isRecording && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mb-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-300 font-mono">{formatDuration(duration)}</span>
          </div>
        </motion.div>
      )}

      {hasRecording && !isRecording && (
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/50">
          <span className="text-green-300">✓ Recorded {formatDuration(duration)}</span>
        </div>
      )}

      <div className="flex justify-center gap-3">
        {!isRecording ? (
          <button onClick={startRecording} className="btn-game-danger px-8">
            {hasRecording ? 'Re-record' : 'Start Recording'}
          </button>
        ) : (
          <button onClick={stopRecording} className="btn-game px-8">
            Stop Recording
          </button>
        )}
      </div>
    </div>
  );
}

