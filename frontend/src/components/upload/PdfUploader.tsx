'use client';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface PdfUploaderProps {
  onPdfSelected: (file: File) => void;
}

export default function PdfUploader({ onPdfSelected }: PdfUploaderProps) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setFileSize((file.size / 1024 / 1024).toFixed(1) + ' MB');
    onPdfSelected(file);
  };

  return (
    <div className="game-card text-center">
      <div className="text-4xl mb-3">📄</div>
      <h3 className="text-lg font-bold mb-2">Upload PDF</h3>
      <p className="text-gray-400 text-sm mb-4">
        Medical reports, lab results, or prescriptions in PDF format
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-blue-500/30 rounded-xl p-6 cursor-pointer
          hover:border-blue-500/60 hover:bg-blue-500/5 transition-all"
      >
        {fileName ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="text-5xl mb-2">📋</div>
            <p className="text-green-300 text-sm font-semibold">{fileName}</p>
            <p className="text-gray-500 text-xs">{fileSize}</p>
          </motion.div>
        ) : (
          <div>
            <div className="text-3xl mb-2 opacity-40">📤</div>
            <p className="text-gray-500 text-sm">Tap to select PDF</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

