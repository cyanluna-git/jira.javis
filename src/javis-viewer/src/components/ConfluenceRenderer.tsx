'use client';

import React, { useState } from 'react';
import { ExternalLink, Image as ImageIcon, ChevronDown, ChevronRight, Info, AlertTriangle, AlertCircle, Lightbulb, XCircle } from 'lucide-react';

interface ConfluenceRendererProps {
  content: string;
}

export function ConfluenceRenderer({ content }: ConfluenceRendererProps) {
  if (!content) {
    return <p className="text-gray-400 italic">No content available</p>;
  }

  // Parse the XHTML content
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  return (
    <div className="confluence-content max-w-4xl mx-auto text-gray-900 leading-relaxed">
      {Array.from(doc.body.childNodes).map((node, idx) => (
        <NodeRenderer key={idx} node={node} />
      ))}
    </div>
  );
}

function NodeRenderer({ node }: { node: Node }) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text.trim()) return null;
    return <>{text}</>;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  // Handle Confluence-specific elements (ac:* and ri:*)
  if (tagName.startsWith('ac:')) {
    return <AcElementRenderer element={element} />;
  }

  if (tagName.startsWith('ri:')) {
    return <RiElementRenderer element={element} />;
  }

  // Handle standard HTML elements
  return <HtmlElementRenderer element={element} />;
}

function AcElementRenderer({ element }: { element: Element }) {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'ac:structured-macro':
      return <MacroRenderer element={element} />;

    case 'ac:image':
      return <AcImageRenderer element={element} />;

    case 'ac:link':
      return <AcLinkRenderer element={element} />;

    case 'ac:emoticon':
      return <EmoticonRenderer element={element} />;

    case 'ac:plain-text-body':
    case 'ac:rich-text-body':
      return (
        <>
          {Array.from(element.childNodes).map((child, idx) => (
            <NodeRenderer key={idx} node={child} />
          ))}
        </>
      );

    case 'ac:parameter':
      // Parameters are handled by parent macros
      return null;

    default:
      // Render children for unknown ac: elements
      return (
        <>
          {Array.from(element.childNodes).map((child, idx) => (
            <NodeRenderer key={idx} node={child} />
          ))}
        </>
      );
  }
}

function RiElementRenderer({ element }: { element: Element }) {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'ri:attachment':
      // Handled by parent ac:image
      return null;

    case 'ri:url':
      const urlValue = element.getAttribute('ri:value');
      if (urlValue) {
        return (
          <a
            href={urlValue}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {urlValue}
          </a>
        );
      }
      return null;

    case 'ri:page':
      const pageTitle = element.getAttribute('ri:content-title');
      return (
        <span className="text-blue-600">
          {pageTitle || 'Page Link'}
        </span>
      );

    case 'ri:user':
      const userKey = element.getAttribute('ri:userkey') || element.getAttribute('ri:account-id');
      return (
        <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm">
          @{userKey || 'user'}
        </span>
      );

    default:
      return null;
  }
}

function MacroRenderer({ element }: { element: Element }) {
  const macroName = element.getAttribute('ac:name') || '';

  switch (macroName) {
    case 'code':
      return <CodeMacro element={element} />;

    case 'info':
    case 'note':
    case 'warning':
    case 'tip':
    case 'error':
      return <PanelMacro element={element} type={macroName} />;

    case 'expand':
      return <ExpandMacro element={element} />;

    case 'status':
      return <StatusMacro element={element} />;

    case 'toc':
      return <TocMacro />;

    case 'anchor':
      const anchorName = getParameter(element, '');
      return <span id={anchorName} />;

    case 'excerpt':
    case 'excerpt-include':
      return (
        <div className="border-l-4 border-gray-300 pl-4 my-4 text-gray-600">
          {renderMacroBody(element)}
        </div>
      );

    case 'noformat':
      return (
        <pre className="mb-3 bg-gray-100 text-gray-800 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-sm">
          {element.textContent}
        </pre>
      );

    case 'panel':
      return <CustomPanelMacro element={element} />;

    default:
      // Render body content for unknown macros
      return <>{renderMacroBody(element)}</>;
  }
}

function CodeMacro({ element }: { element: Element }) {
  const language = getParameter(element, 'language') || 'text';
  const title = getParameter(element, 'title');
  const codeBody = element.querySelector('ac\\:plain-text-body')?.textContent ||
                   element.textContent || '';

  return (
    <div className="mb-4">
      {title && (
        <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm font-medium">
          {title}
        </div>
      )}
      <pre className={`bg-gray-900 text-gray-100 p-4 overflow-x-auto font-mono text-sm ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <code className={`language-${language}`}>
          {codeBody.trim()}
        </code>
      </pre>
      {language !== 'text' && (
        <div className="text-xs text-gray-500 mt-1">{language}</div>
      )}
    </div>
  );
}

function PanelMacro({ element, type }: { element: Element; type: string }) {
  const panelConfig: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      icon: <Info className="w-5 h-5 text-blue-500" />,
    },
    note: {
      bg: 'bg-purple-50',
      border: 'border-purple-400',
      icon: <Info className="w-5 h-5 text-purple-500" />,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    },
    tip: {
      bg: 'bg-green-50',
      border: 'border-green-400',
      icon: <Lightbulb className="w-5 h-5 text-green-500" />,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      icon: <XCircle className="w-5 h-5 text-red-500" />,
    },
  };

  const config = panelConfig[type] || panelConfig.info;
  const title = getParameter(element, 'title');

  return (
    <div className={`mb-4 p-4 ${config.bg} border-l-4 ${config.border} rounded-r`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          {title && <div className="font-semibold mb-2 text-gray-900">{title}</div>}
          <div className="text-gray-800">{renderMacroBody(element)}</div>
        </div>
      </div>
    </div>
  );
}

function CustomPanelMacro({ element }: { element: Element }) {
  const title = getParameter(element, 'title');
  const borderColor = getParameter(element, 'borderColor') || '#ccc';
  const bgColor = getParameter(element, 'bgColor') || '#f5f5f5';

  return (
    <div
      className="mb-4 p-4 rounded border-l-4"
      style={{ backgroundColor: bgColor, borderLeftColor: borderColor }}
    >
      {title && <div className="font-semibold mb-2 text-gray-900">{title}</div>}
      <div className="text-gray-800">{renderMacroBody(element)}</div>
    </div>
  );
}

function ExpandMacro({ element }: { element: Element }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const title = getParameter(element, 'title') || 'Click to expand...';

  return (
    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left font-medium text-gray-700"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {title}
      </button>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200">
          {renderMacroBody(element)}
        </div>
      )}
    </div>
  );
}

function StatusMacro({ element }: { element: Element }) {
  const color = getParameter(element, 'colour') || getParameter(element, 'color') || 'Grey';
  const title = getParameter(element, 'title') || '';

  const colorMap: Record<string, string> = {
    Grey: 'bg-gray-200 text-gray-700',
    Gray: 'bg-gray-200 text-gray-700',
    Blue: 'bg-blue-100 text-blue-700',
    Green: 'bg-green-100 text-green-700',
    Yellow: 'bg-yellow-100 text-yellow-700',
    Red: 'bg-red-100 text-red-700',
    Purple: 'bg-purple-100 text-purple-700',
  };

  const colorClass = colorMap[color] || colorMap.Grey;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${colorClass}`}>
      {title}
    </span>
  );
}

function TocMacro() {
  return (
    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-sm text-gray-500 italic">
        [Table of Contents - rendered in Confluence]
      </div>
    </div>
  );
}

function AcImageRenderer({ element }: { element: Element }) {
  const attachment = element.querySelector('ri\\:attachment');
  const url = element.querySelector('ri\\:url');

  const filename = attachment?.getAttribute('ri:filename') || 'image';
  const alt = element.getAttribute('ac:alt') || filename;
  const width = element.getAttribute('ac:width');
  const height = element.getAttribute('ac:height');

  // If there's a direct URL
  if (url) {
    const urlValue = url.getAttribute('ri:value');
    if (urlValue) {
      return (
        <div className="mb-3">
          <img
            src={urlValue}
            alt={alt}
            className="max-w-full h-auto rounded border border-gray-200"
            style={width ? { maxWidth: `${width}px` } : {}}
          />
        </div>
      );
    }
  }

  // Show placeholder for attachments (would need authentication)
  return (
    <div className="mb-3 p-6 bg-gray-100 rounded-lg border border-gray-200 text-center">
      <div className="flex flex-col items-center gap-2 text-gray-500">
        <ImageIcon className="w-10 h-10 opacity-50" />
        <div>
          <div className="font-medium text-gray-700">{filename}</div>
          <div className="text-sm text-gray-400">Image attachment</div>
          {width && height && (
            <div className="text-xs text-gray-400 mt-1">{width} × {height}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AcLinkRenderer({ element }: { element: Element }) {
  const page = element.querySelector('ri\\:page');
  const attachment = element.querySelector('ri\\:attachment');
  const url = element.querySelector('ri\\:url');
  const linkBody = element.querySelector('ac\\:link-body, ac\\:plain-text-link-body');

  const linkText = linkBody?.textContent ||
                   page?.getAttribute('ri:content-title') ||
                   attachment?.getAttribute('ri:filename') ||
                   'Link';

  if (url) {
    const urlValue = url.getAttribute('ri:value');
    return (
      <a
        href={urlValue || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
      >
        {linkText}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  if (page) {
    const spaceKey = page.getAttribute('ri:space-key');
    const pageTitle = page.getAttribute('ri:content-title');
    return (
      <span className="text-blue-600 hover:text-blue-800 cursor-pointer" title={`${spaceKey ? `[${spaceKey}] ` : ''}${pageTitle}`}>
        {linkText}
      </span>
    );
  }

  return <span className="text-blue-600">{linkText}</span>;
}

function EmoticonRenderer({ element }: { element: Element }) {
  const name = element.getAttribute('ac:name') || '';

  const emojiMap: Record<string, string> = {
    smile: '😊',
    sad: '😢',
    cheeky: '😜',
    laugh: '😄',
    wink: '😉',
    thumbs_up: '👍',
    thumbs_down: '👎',
    information: 'ℹ️',
    tick: '✅',
    cross: '❌',
    warning: '⚠️',
    plus: '➕',
    minus: '➖',
    question: '❓',
    light_on: '💡',
    light_off: '💡',
    yellow_star: '⭐',
    red_star: '⭐',
    green_star: '⭐',
    blue_star: '⭐',
    heart: '❤️',
    broken_heart: '💔',
  };

  return <span>{emojiMap[name] || '😊'}</span>;
}

function HtmlElementRenderer({ element }: { element: Element }) {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'p':
      return (
        <p className="mb-3 leading-relaxed">
          {renderChildren(element)}
        </p>
      );

    case 'h1':
      return <h1 className="text-2xl font-bold mb-4 mt-6 text-gray-900">{renderChildren(element)}</h1>;
    case 'h2':
      return <h2 className="text-xl font-bold mb-3 mt-5 text-gray-900">{renderChildren(element)}</h2>;
    case 'h3':
      return <h3 className="text-lg font-bold mb-3 mt-4 text-gray-900">{renderChildren(element)}</h3>;
    case 'h4':
      return <h4 className="text-base font-bold mb-2 mt-4 text-gray-900">{renderChildren(element)}</h4>;
    case 'h5':
      return <h5 className="text-sm font-bold mb-2 mt-3 text-gray-900">{renderChildren(element)}</h5>;
    case 'h6':
      return <h6 className="text-sm font-bold mb-2 mt-3 text-gray-900">{renderChildren(element)}</h6>;

    case 'ul':
      return (
        <ul className="list-disc list-inside mb-3 space-y-1 ml-4">
          {renderChildren(element)}
        </ul>
      );

    case 'ol':
      return (
        <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">
          {renderChildren(element)}
        </ol>
      );

    case 'li':
      return (
        <li className="ml-2">
          {renderChildrenInline(element)}
        </li>
      );

    case 'a':
      const href = element.getAttribute('href') || '#';
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {renderChildren(element)}
        </a>
      );

    case 'strong':
    case 'b':
      return <strong className="font-bold">{renderChildren(element)}</strong>;

    case 'em':
    case 'i':
      return <em className="italic">{renderChildren(element)}</em>;

    case 'u':
      return <u className="underline">{renderChildren(element)}</u>;

    case 's':
    case 'strike':
    case 'del':
      return <s className="line-through">{renderChildren(element)}</s>;

    case 'code':
      return (
        <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
          {element.textContent}
        </code>
      );

    case 'pre':
      return (
        <pre className="mb-3 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
          {element.textContent}
        </pre>
      );

    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-600 mb-3 bg-gray-50 py-2">
          {renderChildren(element)}
        </blockquote>
      );

    case 'hr':
      return <hr className="my-6 border-gray-300" />;

    case 'br':
      return <br />;

    case 'table':
      return (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            {renderChildren(element)}
          </table>
        </div>
      );

    case 'thead':
      return <thead className="bg-gray-100">{renderChildren(element)}</thead>;

    case 'tbody':
      return <tbody>{renderChildren(element)}</tbody>;

    case 'tr':
      return <tr className="border-b border-gray-300">{renderChildren(element)}</tr>;

    case 'th':
      return (
        <th className="border border-gray-300 px-4 py-2 text-left font-semibold bg-gray-100 text-gray-900">
          {renderChildren(element)}
        </th>
      );

    case 'td':
      const colSpan = element.getAttribute('colspan');
      const rowSpan = element.getAttribute('rowspan');
      return (
        <td
          className="border border-gray-300 px-4 py-2 text-left"
          colSpan={colSpan ? parseInt(colSpan) : undefined}
          rowSpan={rowSpan ? parseInt(rowSpan) : undefined}
        >
          {renderChildren(element)}
        </td>
      );

    case 'colgroup':
    case 'col':
      return null;

    case 'img':
      const src = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || 'Image';
      return (
        <img
          src={src}
          alt={alt}
          className="max-w-full h-auto my-2 rounded border border-gray-200"
        />
      );

    case 'span':
      const style = element.getAttribute('style');
      if (style) {
        return <span style={parseStyle(style)}>{renderChildren(element)}</span>;
      }
      return <span>{renderChildren(element)}</span>;

    case 'div':
      const divClass = element.getAttribute('class');
      return (
        <div className={divClass || ''}>
          {renderChildren(element)}
        </div>
      );

    case 'sup':
      return <sup>{renderChildren(element)}</sup>;

    case 'sub':
      return <sub>{renderChildren(element)}</sub>;

    case 'time':
      const datetime = element.getAttribute('datetime');
      return (
        <time dateTime={datetime || undefined} className="text-gray-600">
          {element.textContent}
        </time>
      );

    default:
      // Render children for unknown HTML elements
      return <>{renderChildren(element)}</>;
  }
}

// Helper functions

function renderChildren(element: Element): React.ReactNode {
  return Array.from(element.childNodes).map((child, idx) => (
    <NodeRenderer key={idx} node={child} />
  ));
}

// Render children inline - used for list items to avoid block-level elements causing line breaks
function renderChildrenInline(element: Element): React.ReactNode {
  return Array.from(element.childNodes).map((child, idx) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (!text.trim()) return null;
      return <span key={idx}>{text}</span>;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      // Convert block elements to inline within list items
      if (tagName === 'p') {
        return (
          <span key={idx}>
            {renderChildrenInline(el)}
          </span>
        );
      }
    }

    return <NodeRenderer key={idx} node={child} />;
  });
}

function renderMacroBody(element: Element): React.ReactNode {
  const richTextBody = element.querySelector('ac\\:rich-text-body');
  const plainTextBody = element.querySelector('ac\\:plain-text-body');

  if (richTextBody) {
    return renderChildren(richTextBody);
  }

  if (plainTextBody) {
    return plainTextBody.textContent;
  }

  // Fallback: render all non-parameter children
  return Array.from(element.childNodes)
    .filter(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        return el.tagName.toLowerCase() !== 'ac:parameter';
      }
      return node.nodeType === Node.TEXT_NODE;
    })
    .map((child, idx) => <NodeRenderer key={idx} node={child} />);
}

function getParameter(element: Element, name: string): string | null {
  const params = element.querySelectorAll('ac\\:parameter');
  for (const param of Array.from(params)) {
    const paramName = param.getAttribute('ac:name');
    if (paramName === name || (name === '' && !paramName)) {
      return param.textContent;
    }
  }
  return null;
}

function parseStyle(styleString: string): React.CSSProperties {
  const style: Record<string, string> = {};
  const declarations = styleString.split(';').filter(Boolean);

  for (const declaration of declarations) {
    const [property, value] = declaration.split(':').map(s => s.trim());
    if (property && value) {
      // Convert CSS property to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      style[camelProperty] = value;
    }
  }

  return style as React.CSSProperties;
}
