'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Paperclip, X, AlertCircle, User } from 'lucide-react';
import { SUBMIT_FORM_GROUPS, type ServiceDeskRequestResponse } from '@/types/service-desk';
import type { AuthUser } from '@/lib/access';

const MAX_SUMMARY_LEN = 255;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

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
}

export default function ServiceDeskSubmitForm({ currentUser, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          fileError = `"${file.name}" 파일이 10MB 제한을 초과합니다.`;
          continue;
        }
        if (running + file.size > MAX_TOTAL_BYTES) {
          fileError = '첨부파일 합계 크기가 25MB를 초과할 수 없습니다.';
          break;
        }
        running += file.size;
        next.push(file);
      }

      if (fileError) setError(fileError);
      return { ...prev, files: next };
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setError(err instanceof Error ? err.message : '요청 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.summary.trim() && form.group && form.component;

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submitter (read-only from session) */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-gray-500">제출자: </span>
          {currentUser?.name || currentUser?.email ? (
            <span className="text-gray-900 font-medium">
              {currentUser.name}
              {currentUser.email && (
                <span className="text-gray-500 font-normal ml-1">({currentUser.email})</span>
              )}
            </span>
          ) : (
            <span className="text-gray-400 italic">세션 정보 없음</span>
          )}
        </div>
      </div>

      {/* Group + Component cascade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="group" className="block text-sm font-medium text-gray-700">
            그룹 <span className="text-red-500">*</span>
          </label>
          <select
            id="group"
            value={form.group}
            onChange={e => handleGroupChange(e.target.value)}
            required
            className={`${inputClass} bg-white`}
          >
            <option value="">그룹 선택</option>
            {Object.keys(SUBMIT_FORM_GROUPS).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="component" className="block text-sm font-medium text-gray-700">
            컴포넌트 <span className="text-red-500">*</span>
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
              {form.group ? '컴포넌트 선택' : '그룹을 먼저 선택하세요'}
            </option>
            {availableComponents.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="summary"
          type="text"
          value={form.summary}
          onChange={e => setForm(prev => ({ ...prev, summary: e.target.value.slice(0, MAX_SUMMARY_LEN) }))}
          placeholder="요청 제목을 입력하세요"
          required
          maxLength={MAX_SUMMARY_LEN}
          className={inputClass}
        />
        <p className="text-right text-xs text-gray-400">{form.summary.length} / {MAX_SUMMARY_LEN}</p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          상세 내용
        </label>
        <textarea
          id="description"
          value={form.description}
          onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          onPaste={handlePaste}
          placeholder="요청 내용을 상세히 입력하세요 (선택)"
          rows={8}
          className={`${inputClass} resize-y min-h-[180px]`}
        />
        <p className="text-xs text-gray-400">이미지를 Ctrl+V로 붙여넣기 할 수 있습니다.</p>
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            첨부파일{' '}
            <span className="font-normal text-gray-400">(선택, 파일당 10MB · 합계 25MB)</span>
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
            파일 선택
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
        {submitting ? '제출 중...' : '요청 제출'}
      </button>
    </form>
  );
}
