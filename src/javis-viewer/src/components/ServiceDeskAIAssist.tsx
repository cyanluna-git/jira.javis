'use client';

import { Sparkles, RotateCcw, Undo2 } from 'lucide-react';

export type AiState = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  aiState: AiState;
  aiError: string | null;
  canRestore: boolean;
  summaryEmpty: boolean;
  onAssist: () => void;
  onRestore: () => void;
}

export default function ServiceDeskAIAssist({ aiState, aiError, canRestore, summaryEmpty, onAssist, onRestore }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onAssist}
        disabled={summaryEmpty || aiState === 'loading'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {aiState === 'loading' ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            AI 작성 중...
          </>
        ) : aiState === 'done' ? (
          <>
            <RotateCcw className="w-3.5 h-3.5" />
            다시 생성
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            AI 입력 보조
          </>
        )}
      </button>

      {(aiState === 'done' || aiState === 'error') && canRestore && (
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          원본으로
        </button>
      )}

      {aiState === 'error' && aiError && (
        <span className="text-xs text-red-600">{aiError}</span>
      )}
    </div>
  );
}
