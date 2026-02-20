'use client';

import { useState, useCallback } from 'react';
import { X, Save, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import type { SprintIssue } from '@/types/sprint';

interface Props {
  issue: SprintIssue;
  onClose: () => void;
  onSaved?: (updatedIssue: SprintIssue) => void;
}

interface FormData {
  summary: string;
  status: string;
  priority: string;
  labels: string[];
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export default function IssueEditModal({ issue, onClose, onSaved }: Props) {
  const fields = issue.raw_data?.fields || {};

  const [formData, setFormData] = useState<FormData>({
    summary: issue.summary || '',
    status: issue.status || '',
    priority: fields.priority?.name || '',
    labels: fields.labels || [],
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [labelInput, setLabelInput] = useState('');

  // Track which fields have been modified
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  const handleFieldChange = useCallback((field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setModifiedFields(prev => new Set(prev).add(field));
  }, []);

  const handleAddLabel = useCallback(() => {
    const trimmed = labelInput.trim();
    if (trimmed && !formData.labels.includes(trimmed)) {
      handleFieldChange('labels', [...formData.labels, trimmed]);
      setLabelInput('');
    }
  }, [labelInput, formData.labels, handleFieldChange]);

  const handleRemoveLabel = useCallback((label: string) => {
    handleFieldChange('labels', formData.labels.filter(l => l !== label));
  }, [formData.labels, handleFieldChange]);

  const handleSave = async () => {
    if (modifiedFields.size === 0) {
      onClose();
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    // Build update payload with only modified fields
    const payload: Record<string, unknown> = {};
    modifiedFields.forEach(field => {
      payload[field] = formData[field as keyof FormData];
    });

    try {
      const response = await fetch(`/api/issues/${issue.key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save changes');
      }

      const result = await response.json();
      setSaveStatus('success');

      // Update the issue object for parent component
      if (onSaved && result.issue) {
        const updatedIssue: SprintIssue = {
          ...issue,
          summary: result.issue.summary || issue.summary,
          status: result.issue.status || issue.status,
          local_modified_at: result.issue.local_modified_at,
          local_modified_fields: result.issue.local_modified_fields,
        };
        onSaved(updatedIssue);
      }

      // Close after brief success indication
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
      summary: issue.summary || '',
      status: issue.status || '',
      priority: fields.priority?.name || '',
      labels: fields.labels || [],
    });
    setModifiedFields(new Set());
    setSaveStatus('idle');
    setErrorMessage('');
  };

  const hasChanges = modifiedFields.size > 0;
  const isLocallyModified = !!(issue as { local_modified_at?: string }).local_modified_at;

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
            <span className="text-blue-600 font-medium">{issue.key}</span>
            <span className="text-gray-400">|</span>
            <h2 className="text-lg font-semibold text-gray-900">Edit Issue</h2>
            {isLocallyModified && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                Locally Modified
              </span>
            )}
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
          {/* Warning for locally modified issues */}
          {isLocallyModified && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">This issue has unsynchronized local changes</p>
                <p className="text-yellow-700 mt-1">
                  Run the sync script to push changes to Jira or discard local modifications.
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary
              {modifiedFields.has('summary') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => handleFieldChange('summary', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Issue summary"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
              {modifiedFields.has('status') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) => handleFieldChange('status', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Status (e.g., To Do, In Progress, Done)"
            />
            <p className="mt-1 text-xs text-gray-500">
              Note: Status changes may require proper transitions in Jira
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
              {modifiedFields.has('priority') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleFieldChange('priority', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select priority</option>
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Labels
              {modifiedFields.has('labels') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label)}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {formData.labels.length === 0 && (
                <span className="text-sm text-gray-400 italic">No labels</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLabel();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add a label"
              />
              <button
                type="button"
                onClick={handleAddLabel}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {hasChanges ? (
              <span>
                {modifiedFields.size} field{modifiedFields.size > 1 ? 's' : ''} modified
              </span>
            ) : (
              <span>No changes</span>
            )}
          </div>
          <div className="flex gap-3">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            )}
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
              disabled={!hasChanges || saveStatus === 'saving'}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                !hasChanges || saveStatus === 'saving'
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
                  Save Locally
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
