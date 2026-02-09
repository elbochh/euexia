'use client';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
}

export default function ImageUploader({ onImageSelected }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onImageSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div className="game-card text-center">
      <div className="text-4xl mb-3">📷</div>
      <h3 className="text-lg font-bold mb-2">Upload Image</h3>
      <p className="text-gray-400 text-sm mb-4">
        Photo of reports, prescriptions, or medical documents
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-blue-500/30 rounded-xl p-6 cursor-pointer
          hover:border-blue-500/60 hover:bg-blue-500/5 transition-all"
      >
        {preview ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 mx-auto rounded-lg mb-2"
            />
            <p className="text-green-300 text-sm">✓ {fileName}</p>
          </motion.div>
        ) : (
          <div>
            <div className="text-3xl mb-2 opacity-40">📤</div>
            <p className="text-gray-500 text-sm">
              Tap to select or drag & drop
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

