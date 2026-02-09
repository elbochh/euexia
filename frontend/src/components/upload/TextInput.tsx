'use client';
import { useState } from 'react';

interface TextInputProps {
  onTextSubmit: (text: string) => void;
}

export default function TextInput({ onTextSubmit }: TextInputProps) {
  const [text, setText] = useState('');

  return (
    <div className="game-card text-center">
      <div className="text-4xl mb-3">📝</div>
      <h3 className="text-lg font-bold mb-2">Text Notes</h3>
      <p className="text-gray-400 text-sm mb-4">
        Type your consultation notes or doctor&apos;s instructions
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.length > 0) onTextSubmit(e.target.value);
        }}
        placeholder="e.g., Doctor said to take medication twice daily, reduce salt intake, schedule blood work next week..."
        className="w-full h-40 p-4 rounded-xl bg-game-bg border border-blue-500/30 text-white
          placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/60
          transition-colors font-game text-sm"
      />

      <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
        <span>{text.length} characters</span>
        {text.length > 0 && <span className="text-green-400">✓ Ready</span>}
      </div>
    </div>
  );
}

