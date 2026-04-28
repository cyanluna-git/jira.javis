'use client';

import { Sparkles, RotateCcw, Undo2 } from 'lucide-react';
import type { Lang } from '@/components/ServiceDeskSubmitForm';

export type AiState = 'idle' | 'loading' | 'done' | 'error';

const T = {
  ko: {
    assist: 'AI 입력 보조',
    loading: 'AI 작성 중...',
    regenerate: '다시 생성',
    restore: '원본으로',
    titleEmpty: '제목을 먼저 입력하세요',
  },
  en: {
    assist: 'AI Assist',
    loading: 'AI writing...',
    regenerate: 'Regenerate',
    restore: 'Restore',
    titleEmpty: 'Enter a title first',
  },
} as const;

interface Props {
  aiState: AiState;
  aiError: string | null;
  canRestore: boolean;
  summaryEmpty: boolean;
  onAssist: () => void;
  onRestore: () => void;
  lang?: Lang;
}

export default function ServiceDeskAIAssist({ aiState, aiError, canRestore, summaryEmpty, onAssist, onRestore, lang = 'ko' }: Props) {
  const t = T[lang];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onAssist}
        disabled={summaryEmpty || aiState === 'loading'}
        title={summaryEmpty ? t.titleEmpty : undefined}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {aiState === 'loading' ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            {t.loading}
          </>
        ) : aiState === 'done' ? (
          <>
            <RotateCcw className="w-3.5 h-3.5" />
            {t.regenerate}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            {t.assist}
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
          {t.restore}
        </button>
      )}

      {aiState === 'error' && aiError && (
        <span className="text-xs text-red-600">{aiError}</span>
      )}
    </div>
  );
}
