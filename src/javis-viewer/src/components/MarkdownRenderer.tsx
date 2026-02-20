'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * Simple Markdown renderer with styling consistent with AdfRenderer
 * Supports: headings, bold, italic, code, links, lists, blockquotes, horizontal rules
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) {
    return <p className="text-gray-400 italic">No description available</p>;
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let blockquoteLines: string[] = [];

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type === 'ul' ? 'ul' : 'ol';
      const listClass = currentList.type === 'ul'
        ? 'list-disc list-inside mb-3 space-y-1 ml-4'
        : 'list-decimal list-inside mb-3 space-y-1 ml-4';
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listClass}>
          {currentList.items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      elements.push(
        <blockquote
          key={`bq-${elements.length}`}
          className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-3"
        >
          {blockquoteLines.map((line, idx) => (
            <p key={idx}>{renderInline(line)}</p>
          ))}
        </blockquote>
      );
      blockquoteLines = [];
    }
  };

  // Parse table row into cells
  const parseTableRow = (line: string): string[] => {
    // Remove leading/trailing pipes and split by |
    const trimmed = line.trim().replace(/^\||\|$/g, '');
    return trimmed.split('|').map(cell => cell.trim());
  };

  // Check if line is a table separator (|---|---|)
  const isTableSeparator = (line: string): boolean => {
    const trimmed = line.trim();
    return /^\|?[\s\-:|]+\|[\s\-:|]+\|?$/.test(trimmed);
  };

  // Check if line looks like a table row
  const isTableRow = (line: string): boolean => {
    const trimmed = line.trim();
    // Must have at least one | that's not at the very start or end only
    return trimmed.includes('|') && trimmed.split('|').length >= 2;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line
    if (!trimmedLine) {
      flushList();
      flushBlockquote();
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushList();
      flushBlockquote();
      elements.push(<hr key={`hr-${i}`} className="my-4 border-gray-300" />);
      continue;
    }

    // Headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushBlockquote();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const headingClasses = [
        'text-2xl font-bold mb-3 mt-4',
        'text-xl font-bold mb-3 mt-4',
        'text-lg font-bold mb-2 mt-3',
        'text-base font-bold mb-2 mt-3',
        'text-sm font-bold mb-2 mt-2',
        'text-sm font-bold mb-2 mt-2',
      ];
      elements.push(
        <HeadingTag key={`h-${i}`} className={headingClasses[level - 1]}>
          {renderInline(text)}
        </HeadingTag>
      );
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith('>')) {
      flushList();
      const quoteText = trimmedLine.slice(1).trim();
      blockquoteLines.push(quoteText);
      continue;
    }

    // Unordered list
    const ulMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushBlockquote();
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushBlockquote();
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Code block (simple ``` detection)
    if (trimmedLine.startsWith('```')) {
      flushList();
      flushBlockquote();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="mb-3 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Table detection
    if (isTableRow(trimmedLine)) {
      flushList();
      flushBlockquote();

      const tableRows: string[][] = [];
      let hasHeader = false;
      let headerRow: string[] = [];

      // First row (potential header)
      headerRow = parseTableRow(trimmedLine);
      i++;

      // Check if next line is separator
      if (i < lines.length && isTableSeparator(lines[i])) {
        hasHeader = true;
        i++; // Skip separator line
      } else {
        // No separator, treat first row as data
        tableRows.push(headerRow);
        headerRow = [];
      }

      // Collect remaining table rows
      while (i < lines.length && isTableRow(lines[i].trim()) && !isTableSeparator(lines[i])) {
        tableRows.push(parseTableRow(lines[i]));
        i++;
      }
      i--; // Back up one since the for loop will increment

      elements.push(
        <div key={`table-${elements.length}`} className="mb-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            {hasHeader && headerRow.length > 0 && (
              <thead className="bg-gray-100">
                <tr>
                  {headerRow.map((cell, cellIdx) => (
                    <th
                      key={cellIdx}
                      className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700"
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border border-gray-300 px-4 py-2 text-sm text-gray-700"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    flushBlockquote();
    elements.push(
      <p key={`p-${i}`} className="mb-3 leading-relaxed">
        {renderInline(trimmedLine)}
      </p>
    );
  }

  // Flush any remaining list or blockquote
  flushList();
  flushBlockquote();

  return <div className={`markdown-content ${className}`}>{elements}</div>;
}

/**
 * Render inline markdown: bold, italic, code, links, strikethrough
 */
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold: **text** or __text__
    let match = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/);
    if (match) {
      if (match[1]) parts.push(renderInline(match[1]));
      parts.push(<strong key={`b-${keyIndex++}`} className="font-bold">{renderInline(match[3])}</strong>);
      remaining = match[4];
      continue;
    }

    // Italic: *text* or _text_
    match = remaining.match(/^(.*?)(\*|_)(.+?)\2(.*)$/);
    if (match && !match[1].endsWith('\\')) {
      if (match[1]) parts.push(renderInline(match[1]));
      parts.push(<em key={`i-${keyIndex++}`} className="italic">{renderInline(match[3])}</em>);
      remaining = match[4];
      continue;
    }

    // Inline code: `code`
    match = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    if (match) {
      if (match[1]) parts.push(match[1]);
      parts.push(
        <code key={`c-${keyIndex++}`} className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
          {match[2]}
        </code>
      );
      remaining = match[3];
      continue;
    }

    // Strikethrough: ~~text~~
    match = remaining.match(/^(.*?)~~(.+?)~~(.*)$/);
    if (match) {
      if (match[1]) parts.push(match[1]);
      parts.push(<s key={`s-${keyIndex++}`} className="line-through">{renderInline(match[2])}</s>);
      remaining = match[3];
      continue;
    }

    // Link: [text](url)
    match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
    if (match) {
      if (match[1]) parts.push(match[1]);
      parts.push(
        <a
          key={`a-${keyIndex++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {match[2]}
        </a>
      );
      remaining = match[4];
      continue;
    }

    // No more patterns, add remaining text
    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default MarkdownRenderer;
