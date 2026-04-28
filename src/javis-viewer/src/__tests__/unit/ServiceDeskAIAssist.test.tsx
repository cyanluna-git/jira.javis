/**
 * Unit tests for ServiceDeskAIAssist component.
 *
 * Covers: button states (idle/loading/done/error), restore button visibility,
 * disabled conditions, and error message display.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ServiceDeskAIAssist, { type AiState } from '@/components/ServiceDeskAIAssist';

// Lucide icons use SVG — jsdom handles them fine
jest.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles" />,
  RotateCcw: () => <span data-testid="icon-rotate-ccw" />,
  Undo2: () => <span data-testid="icon-undo2" />,
}));

function renderComponent(overrides: Partial<{
  aiState: AiState;
  aiError: string | null;
  canRestore: boolean;
  summaryEmpty: boolean;
  onAssist: () => void;
  onRestore: () => void;
}> = {}) {
  const props = {
    aiState: 'idle' as AiState,
    aiError: null,
    canRestore: false,
    summaryEmpty: false,
    onAssist: jest.fn(),
    onRestore: jest.fn(),
    ...overrides,
  };
  return { ...render(<ServiceDeskAIAssist {...props} />), props };
}

describe('ServiceDeskAIAssist', () => {
  // ── idle state ───────────────────────────────────────────────────────────

  describe('idle state', () => {
    it('shows "AI 입력 보조" button label', () => {
      renderComponent({ aiState: 'idle' });
      expect(screen.getByRole('button', { name: /AI 입력 보조/i })).toBeInTheDocument();
    });

    it('button is enabled when summary is not empty', () => {
      renderComponent({ aiState: 'idle', summaryEmpty: false });
      expect(screen.getByRole('button', { name: /AI 입력 보조/i })).not.toBeDisabled();
    });

    it('button is disabled when summary is empty', () => {
      renderComponent({ aiState: 'idle', summaryEmpty: true });
      expect(screen.getByRole('button', { name: /AI 입력 보조/i })).toBeDisabled();
    });

    it('does not show restore button when canRestore is false', () => {
      renderComponent({ aiState: 'idle', canRestore: false });
      expect(screen.queryByRole('button', { name: /원본으로/i })).not.toBeInTheDocument();
    });

    it('does not show error message', () => {
      renderComponent({ aiState: 'idle', aiError: 'some error' });
      // Error is only shown in error state
      expect(screen.queryByText('some error')).not.toBeInTheDocument();
    });
  });

  // ── loading state ────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows "AI 작성 중..." label', () => {
      renderComponent({ aiState: 'loading' });
      expect(screen.getByText(/AI 작성 중/i)).toBeInTheDocument();
    });

    it('button is disabled during loading', () => {
      renderComponent({ aiState: 'loading', summaryEmpty: false });
      const btn = screen.getByRole('button', { name: /AI 작성 중/i });
      expect(btn).toBeDisabled();
    });

    it('does not show restore button during loading', () => {
      renderComponent({ aiState: 'loading', canRestore: true });
      expect(screen.queryByRole('button', { name: /원본으로/i })).not.toBeInTheDocument();
    });
  });

  // ── done state ───────────────────────────────────────────────────────────

  describe('done state', () => {
    it('shows "다시 생성" label', () => {
      renderComponent({ aiState: 'done' });
      expect(screen.getByRole('button', { name: /다시 생성/i })).toBeInTheDocument();
    });

    it('shows restore button when canRestore is true', () => {
      renderComponent({ aiState: 'done', canRestore: true });
      expect(screen.getByRole('button', { name: /원본으로/i })).toBeInTheDocument();
    });

    it('does not show restore button when canRestore is false', () => {
      renderComponent({ aiState: 'done', canRestore: false });
      expect(screen.queryByRole('button', { name: /원본으로/i })).not.toBeInTheDocument();
    });

    it('"다시 생성" button is enabled when summary is not empty', () => {
      renderComponent({ aiState: 'done', summaryEmpty: false });
      expect(screen.getByRole('button', { name: /다시 생성/i })).not.toBeDisabled();
    });

    it('"다시 생성" button is disabled when summary is empty', () => {
      renderComponent({ aiState: 'done', summaryEmpty: true });
      expect(screen.getByRole('button', { name: /다시 생성/i })).toBeDisabled();
    });
  });

  // ── error state ──────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error message when aiError is set', () => {
      renderComponent({ aiState: 'error', aiError: 'AI 서버 오류', canRestore: false });
      expect(screen.getByText('AI 서버 오류')).toBeInTheDocument();
    });

    it('does not show error message when aiError is null', () => {
      renderComponent({ aiState: 'error', aiError: null, canRestore: false });
      // No error text
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows restore button when canRestore is true in error state', () => {
      renderComponent({ aiState: 'error', canRestore: true, aiError: 'timeout' });
      expect(screen.getByRole('button', { name: /원본으로/i })).toBeInTheDocument();
    });
  });

  // ── callback behaviour ────────────────────────────────────────────────────

  describe('callback invocation', () => {
    it('calls onAssist when AI button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderComponent({ aiState: 'idle', summaryEmpty: false });
      await user.click(screen.getByRole('button', { name: /AI 입력 보조/i }));
      expect(props.onAssist).toHaveBeenCalledTimes(1);
    });

    it('does not call onAssist when button is disabled (summary empty)', async () => {
      const user = userEvent.setup();
      const { props } = renderComponent({ aiState: 'idle', summaryEmpty: true });
      await user.click(screen.getByRole('button', { name: /AI 입력 보조/i }));
      expect(props.onAssist).not.toHaveBeenCalled();
    });

    it('calls onRestore when 원본으로 button is clicked', async () => {
      const user = userEvent.setup();
      const { props } = renderComponent({ aiState: 'done', canRestore: true });
      await user.click(screen.getByRole('button', { name: /원본으로/i }));
      expect(props.onRestore).toHaveBeenCalledTimes(1);
    });
  });
});
