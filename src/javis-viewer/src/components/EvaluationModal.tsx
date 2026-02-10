'use client';

import { useState, useCallback } from 'react';
import { X, Save, RefreshCw, Check, Star, AlertCircle } from 'lucide-react';
import type { TeamMember, CreateEvaluationInput, ScoreAdjustments } from '@/types/member';

interface Props {
  member: TeamMember;
  evaluatorId: string;
  initialData?: Partial<CreateEvaluationInput>;
  onClose: () => void;
  onSaved?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const evaluationFields = [
  { key: 'technical_skill', label: 'Technical Skill', description: 'Coding ability, architecture understanding' },
  { key: 'communication', label: 'Communication', description: 'Documentation, team communication' },
  { key: 'problem_solving', label: 'Problem Solving', description: 'Debugging, creative solutions' },
  { key: 'initiative', label: 'Initiative', description: 'Proactive improvements, ownership' },
  { key: 'teamwork', label: 'Teamwork', description: 'Collaboration, code reviews, helping others' },
] as const;

const scoreAdjustmentFields = [
  { key: 'development_score', label: 'Development Score' },
  { key: 'review_score', label: 'Review Score' },
  { key: 'testing_score', label: 'Testing Score' },
  { key: 'collaboration_score', label: 'Collaboration Score' },
] as const;

function StarRating({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`p-1 transition-colors ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}
        >
          <Star
            className={`w-6 h-6 ${
              value && star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 hover:text-yellow-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function EvaluationModal({
  member,
  evaluatorId,
  initialData,
  onClose,
  onSaved,
}: Props) {
  const [formData, setFormData] = useState<CreateEvaluationInput>({
    evaluation_period: initialData?.evaluation_period || getCurrentPeriod(),
    technical_skill: initialData?.technical_skill,
    communication: initialData?.communication,
    problem_solving: initialData?.problem_solving,
    initiative: initialData?.initiative,
    teamwork: initialData?.teamwork,
    strengths: initialData?.strengths || '',
    improvements: initialData?.improvements || '',
    notes: initialData?.notes || '',
    score_adjustments: initialData?.score_adjustments || {},
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function getCurrentPeriod(): string {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${quarter}`;
  }

  const handleFieldChange = useCallback(
    <K extends keyof CreateEvaluationInput>(field: K, value: CreateEvaluationInput[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleScoreAdjustment = useCallback((key: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const clamped = Math.max(-20, Math.min(20, numValue)); // Clamp to -20 to +20

    setFormData((prev) => ({
      ...prev,
      score_adjustments: {
        ...prev.score_adjustments,
        [key]: clamped,
      },
    }));
  }, []);

  const handleSave = async () => {
    if (!formData.evaluation_period) {
      setErrorMessage('Evaluation period is required');
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    try {
      const response = await fetch(
        `/api/members/${member.id}/evaluate?evaluated_by=${encodeURIComponent(evaluatorId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save evaluation');
      }

      setSaveStatus('success');
      onSaved?.();

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleReset = () => {
    setFormData({
      evaluation_period: getCurrentPeriod(),
      strengths: '',
      improvements: '',
      notes: '',
      score_adjustments: {},
    });
    setSaveStatus('idle');
    setErrorMessage('');
  };

  const totalAdjustment = Object.values(formData.score_adjustments || {}).reduce(
    (sum: number, v) => sum + (v || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {member.avatar_url && (
              <img
                src={member.avatar_url}
                alt={member.display_name}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Evaluate {member.display_name}</h2>
              <p className="text-sm text-gray-500">Period: {formData.evaluation_period}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Period Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evaluation Period
            </label>
            <input
              type="text"
              value={formData.evaluation_period}
              onChange={(e) => handleFieldChange('evaluation_period', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 2026-Q1, 2026-01, Sprint 45"
            />
          </div>

          {/* Star Ratings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Performance Ratings
            </h3>
            {evaluationFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">{field.label}</div>
                  <div className="text-xs text-gray-500">{field.description}</div>
                </div>
                <StarRating
                  value={formData[field.key] ?? null}
                  onChange={(v) => handleFieldChange(field.key, v)}
                />
              </div>
            ))}
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Feedback
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Strengths
              </label>
              <textarea
                value={formData.strengths}
                onChange={(e) => handleFieldChange('strengths', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="What this person does well..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Areas for Improvement
              </label>
              <textarea
                value={formData.improvements}
                onChange={(e) => handleFieldChange('improvements', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Where they can grow..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Any other observations..."
              />
            </div>
          </div>

          {/* Score Adjustments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Score Adjustments
              </h3>
              {totalAdjustment !== 0 && (
                <span
                  className={`text-sm font-medium ${
                    totalAdjustment > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  Net: {totalAdjustment > 0 ? '+' : ''}
                  {totalAdjustment}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Manually adjust member scores (-20 to +20). Changes will be recorded in history.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {scoreAdjustmentFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="-20"
                      max="20"
                      value={(formData.score_adjustments as ScoreAdjustments)?.[field.key] || 0}
                      onChange={(e) => handleScoreAdjustment(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="text-gray-400 text-sm">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Evaluator: {evaluatorId}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                saveStatus === 'saving'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : saveStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saveStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saveStatus === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Evaluation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
