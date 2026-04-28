'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Paperclip, X, AlertCircle, User, LogIn } from 'lucide-react';
import { useReadOnly } from '@/contexts/ReadOnlyContext';
import { SUBMIT_FORM_GROUPS, type ServiceDeskRequestResponse } from '@/types/service-desk';
import type { AuthUser } from '@/lib/access';
import ServiceDeskAIAssist, { type AiState } from '@/components/ServiceDeskAIAssist';

const MAX_SUMMARY_LEN = 255;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const EOB_LOGIN_URL = process.env.NEXT_PUBLIC_EOB_LOGIN_URL ?? '';

export type Lang = 'ko' | 'en';

const T = {
  ko: {
    submitter: '제출자',
    group: '그룹',
    groupPlaceholder: '그룹 선택',
    component: '컴포넌트',
    componentPlaceholder: '컴포넌트 선택',
    componentSelectGroupFirst: '그룹을 먼저 선택하세요',
    title: '제목',
    titlePlaceholder: '요청 제목을 입력하세요',
    description: '상세 내용',
    descriptionPlaceholder: `• 대상 모델명: (예: Gen3+ HRS #4, EXE:5000 D, ...)
• SW Bundle 버전: (예: v3.2.1-rc2)
• 문제 현상 또는 요청 사항:
  - 언제, 어떤 상황에서 발생하는지
  - 재현 조건 (있는 경우)
• 기타 참고 사항: (관련 Jira 번호, 장비 S/N 등)`,
    imageHint: '이미지를 Ctrl+V로 붙여넣기 할 수 있습니다.',
    attachments: '첨부파일',
    attachmentsHint: '(선택, 파일당 10MB · 합계 25MB)',
    chooseFiles: '파일 선택',
    submit: '요청 제출',
    submitting: '제출 중...',
    loginRequired: '로그인이 필요합니다',
    loginHint: 'PSSM 티켓을 제출하려면 Edwards 계정으로 로그인하세요.',
    loginButton: 'Edwards 계정으로 로그인',
    fileTooLarge: (name: string) => `"${name}" 파일이 10MB 제한을 초과합니다.`,
    totalTooLarge: '첨부파일 합계 크기가 25MB를 초과할 수 없습니다.',
    submitFailed: '요청 제출에 실패했습니다. 다시 시도해주세요.',
    emptyResponse: '빈 응답이 반환되었습니다.',
    aiFailed: 'AI 보조 기능에 오류가 발생했습니다. 다시 시도해주세요.',
  },
  en: {
    submitter: 'Submitter',
    group: 'Group',
    groupPlaceholder: 'Select group',
    component: 'Component',
    componentPlaceholder: 'Select component',
    componentSelectGroupFirst: 'Select a group first',
    title: 'Title',
    titlePlaceholder: 'Enter request title',
    description: 'Description',
    descriptionPlaceholder: `• Target model: (e.g. Gen3+ HRS #4, EXE:5000 D, ...)
• SW Bundle version: (e.g. v3.2.1-rc2)
• Problem description or request:
  - When and under what conditions it occurs
  - Steps to reproduce (if applicable)
• Additional notes: (related Jira ticket, equipment S/N, etc.)`,
    imageHint: 'You can paste images with Ctrl+V.',
    attachments: 'Attachments',
    attachmentsHint: '(Optional, 10MB per file · 25MB total)',
    chooseFiles: 'Choose files',
    submit: 'Submit Request',
    submitting: 'Submitting...',
    loginRequired: 'Login Required',
    loginHint: 'Sign in with your Edwards account to submit a PSSM ticket.',
    loginButton: 'Sign in with Edwards account',
    fileTooLarge: (name: string) => `"${name}" exceeds the 10MB file limit.`,
    totalTooLarge: 'Total attachment size cannot exceed 25MB.',
    submitFailed: 'Failed to submit request. Please try again.',
    emptyResponse: 'Empty response returned.',
    aiFailed: 'AI assist encountered an error. Please try again.',
  },
} as const;

interface FormState {
  group: string;
  component: string;
  summary: string;
  description: string;
  files: File[];
}

const EMPTY_FORM: FormState = {
  group: '',
  component: '',
  summary: '',
  description: '',
  files: [],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  currentUser: AuthUser | null;
  onSuccess: (result: ServiceDeskRequestResponse) => void;
  pcasEnabled?: boolean;
  lang?: Lang;
}

export default function ServiceDeskSubmitForm({ currentUser, onSuccess, pcasEnabled = false, lang = 'ko' }: Props) {
  const t = T[lang];
  const isReadOnly = useReadOnly();
  const hasSession = Boolean(currentUser?.name || currentUser?.email);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiState, setAiState] = useState<AiState>('idle');
  const [aiOriginalDraft, setAiOriginalDraft] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totalBytes = useMemo(() => form.files.reduce((sum, f) => sum + f.size, 0), [form.files]);
  const availableComponents = form.group ? (SUBMIT_FORM_GROUPS[form.group] ?? []) : [];

  const handleGroupChange = (group: string) => {
    setForm(prev => ({ ...prev, group, component: '' }));
  };

  const handleAddFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;

    setForm(prev => {
      const next = [...prev.files];
      let running = prev.files.reduce((sum, f) => sum + f.size, 0);
      let fileError: string | null = null;

      for (const file of Array.from(incoming)) {
        if (file.size > MAX_FILE_BYTES) {
          fileError = t.fileTooLarge(file.name);
          continue;
        }
        if (running + file.size > MAX_TOTAL_BYTES) {
          fileError = t.totalTooLarge;
          break;
        }
        running += file.size;
        next.push(file);
      }

      if (fileError) setError(fileError);
      return { ...prev, files: next };
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleAddFiles(e.clipboardData.files);
    }
  }, [handleAddFiles]);

  const removeFile = useCallback((index: number) => {
    setForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  }, []);

  const handleLogin = () => {
    if (!EOB_LOGIN_URL) return;
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${EOB_LOGIN_URL}?return=${returnUrl}`;
  };

  const handleAiAssist = useCallback(async () => {
    if (aiState === 'idle') {
      setAiOriginalDraft(form.description);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const clientTimeout = setTimeout(() => controller.abort(), 35_000);

    setAiState('loading');
    setAiError(null);

    try {
      const res = await fetch('/api/service-desk/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: form.group,
          component: form.component,
          summary: form.summary,
          draft_description: form.description,
        }),
        signal: controller.signal,
      });

      const data = await res.json() as { enhanced_description?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (!data.enhanced_description) throw new Error(t.emptyResponse);

      setForm(prev => ({ ...prev, description: data.enhanced_description! }));
      setAiState('done');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setAiError(err instanceof Error ? err.message : t.aiFailed);
      setAiState('error');
    } finally {
      clearTimeout(clientTimeout);
    }
  }, [aiState, form.group, form.component, form.summary, form.description, t]);

  const handleAiRestore = useCallback(() => {
    if (aiOriginalDraft === null) return;
    const draft = aiOriginalDraft;
    setForm(prev => ({ ...prev, description: draft }));
    setAiState('idle');
    setAiOriginalDraft(null);
    setAiError(null);
  }, [aiOriginalDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSession) return;

    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append('group', form.group);
    fd.append('component', form.component);
    fd.append('summary', form.summary.trim());
    if (form.description.trim()) fd.append('description', form.description.trim());
    for (const file of form.files) fd.append('files', file);

    try {
      const res = await fetch('/api/service-desk/requests', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json() as ServiceDeskRequestResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = hasSession && form.summary.trim() && form.group && form.component;

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent';

  if (!hasSession) {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-16 gap-6 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-rose-500" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-800">{t.loginRequired}</p>
          <p className="text-sm text-gray-500">{t.loginHint}</p>
        </div>
        {EOB_LOGIN_URL && (
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {t.loginButton}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submitter */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-gray-500">{t.submitter}: </span>
          <span className="text-gray-900 font-medium">{currentUser!.name}</span>
          {currentUser!.email && (
            <span className="text-gray-500 ml-1">({currentUser!.email})</span>
          )}
        </div>
      </div>

      {/* Group + Component */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="group" className="block text-sm font-medium text-gray-700">
            {t.group} <span className="text-red-500">*</span>
          </label>
          <select
            id="group"
            value={form.group}
            onChange={e => handleGroupChange(e.target.value)}
            required
            className={`${inputClass} bg-white`}
          >
            <option value="">{t.groupPlaceholder}</option>
            {Object.keys(SUBMIT_FORM_GROUPS).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="component" className="block text-sm font-medium text-gray-700">
            {t.component} <span className="text-red-500">*</span>
          </label>
          <select
            id="component"
            value={form.component}
            onChange={e => setForm(prev => ({ ...prev, component: e.target.value }))}
            required
            disabled={!form.group}
            className={`${inputClass} bg-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
          >
            <option value="">
              {form.group ? t.componentPlaceholder : t.componentSelectGroupFirst}
            </option>
            {availableComponents.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
          {t.title} <span className="text-red-500">*</span>
        </label>
        <input
          id="summary"
          type="text"
          value={form.summary}
          onChange={e => setForm(prev => ({ ...prev, summary: e.target.value.slice(0, MAX_SUMMARY_LEN) }))}
          placeholder={t.titlePlaceholder}
          required
          maxLength={MAX_SUMMARY_LEN}
          className={inputClass}
        />
        <p className="text-right text-xs text-gray-400">{form.summary.length} / {MAX_SUMMARY_LEN}</p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            {t.description}
          </label>
          {pcasEnabled && !isReadOnly && (
            <ServiceDeskAIAssist
              aiState={aiState}
              aiError={aiError}
              canRestore={aiOriginalDraft !== null}
              summaryEmpty={!form.summary.trim()}
              onAssist={handleAiAssist}
              onRestore={handleAiRestore}
              lang={lang}
            />
          )}
        </div>
        <textarea
          id="description"
          value={form.description}
          onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          onPaste={handlePaste}
          placeholder={t.descriptionPlaceholder}
          rows={8}
          className={`${inputClass} resize-y min-h-[180px]`}
        />
        <p className="text-xs text-gray-400">{t.imageHint}</p>
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            {t.attachments}{' '}
            <span className="font-normal text-gray-400">{t.attachmentsHint}</span>
          </label>
          {form.files.length > 0 && (
            <span className="text-xs text-gray-400">
              {formatBytes(totalBytes)} / {formatBytes(MAX_TOTAL_BYTES)}
            </span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => handleAddFiles(e.target.files)}
            className="hidden"
            id="attachments"
            disabled={submitting}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-4 h-4" />
            {t.chooseFiles}
          </button>
        </div>
        {form.files.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {form.files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3 pr-2">
                  {file.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-10 w-10 shrink-0 rounded object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={submitting}
                  className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || !isValid}
        className="w-full py-2.5 px-4 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
