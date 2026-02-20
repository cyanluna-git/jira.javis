'use client';

import { useState, useCallback } from 'react';
import { X, Save, RefreshCw, Check, Plus, Tag, Box } from 'lucide-react';
import type { Vision, UpdateVisionInput } from '@/types/roadmap';

interface Props {
  vision: Vision;
  onClose: () => void;
  onSaved?: (updatedVision: Vision) => void;
}

interface FormData {
  title: string;
  description: string;
  default_component: string;
  default_labels: string[];
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export default function VisionEditModal({ vision, onClose, onSaved }: Props) {
  const [formData, setFormData] = useState<FormData>({
    title: vision.title || '',
    description: vision.description || '',
    default_component: vision.default_component || '',
    default_labels: vision.default_labels || [],
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [componentInput, setComponentInput] = useState('');
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  const handleFieldChange = useCallback((field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setModifiedFields(prev => new Set(prev).add(field));
  }, []);

  const handleAddLabel = useCallback(() => {
    const trimmed = labelInput.trim().toLowerCase();
    if (trimmed && !formData.default_labels.includes(trimmed)) {
      handleFieldChange('default_labels', [...formData.default_labels, trimmed]);
      setLabelInput('');
    }
  }, [labelInput, formData.default_labels, handleFieldChange]);

  const handleRemoveLabel = useCallback((label: string) => {
    handleFieldChange('default_labels', formData.default_labels.filter(l => l !== label));
  }, [formData.default_labels, handleFieldChange]);

  const handleSetComponent = useCallback(() => {
    const trimmed = componentInput.trim();
    if (trimmed) {
      handleFieldChange('default_component', trimmed);
      setComponentInput('');
    }
  }, [componentInput, handleFieldChange]);

  const handleRemoveComponent = useCallback(() => {
    handleFieldChange('default_component', '');
  }, [handleFieldChange]);

  const handleSave = async () => {
    if (modifiedFields.size === 0) {
      onClose();
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    // Build update payload with only modified fields
    const payload: UpdateVisionInput = {};
    modifiedFields.forEach(field => {
      const value = formData[field as keyof FormData];
      if (field === 'default_component') {
        payload.default_component = value as string || null;
      } else if (field === 'default_labels') {
        payload.default_labels = value as string[];
      } else if (field === 'title') {
        payload.title = value as string;
      } else if (field === 'description') {
        payload.description = value as string;
      }
    });

    try {
      const response = await fetch(`/api/roadmap/visions/${vision.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save changes');
      }

      const result = await response.json();
      setSaveStatus('success');

      if (onSaved) {
        onSaved(result);
      }

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
      title: vision.title || '',
      description: vision.description || '',
      default_component: vision.default_component || '',
      default_labels: vision.default_labels || [],
    });
    setModifiedFields(new Set());
    setComponentInput('');
    setLabelInput('');
    setSaveStatus('idle');
    setErrorMessage('');
  };

  const hasChanges = modifiedFields.size > 0;

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
            <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              {vision.project_key}
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Edit Vision</h2>
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
              {modifiedFields.has('title') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Vision title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
              {modifiedFields.has('description') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Vision description"
            />
          </div>

          {/* Default Component */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Box className="w-4 h-4 inline mr-1.5 text-gray-500" />
              Default Component
              {modifiedFields.has('default_component') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
              {formData.default_component ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {formData.default_component}
                  <button
                    type="button"
                    onClick={handleRemoveComponent}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <span className="text-sm text-gray-400 italic">No default component</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={componentInput}
                onChange={(e) => setComponentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSetComponent();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter component name"
              />
              <button
                type="button"
                onClick={handleSetComponent}
                disabled={!componentInput.trim()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              New issues created under this Vision will use this component by default.
            </p>
          </div>

          {/* Default Labels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-1.5 text-gray-500" />
              Default Labels
              {modifiedFields.has('default_labels') && (
                <span className="ml-2 text-xs text-blue-600">(modified)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
              {formData.default_labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label)}
                    className="hover:text-purple-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {formData.default_labels.length === 0 && (
                <span className="text-sm text-gray-400 italic">No default labels</span>
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
                disabled={!labelInput.trim()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              New issues created under this Vision will have these labels by default.
            </p>
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
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
