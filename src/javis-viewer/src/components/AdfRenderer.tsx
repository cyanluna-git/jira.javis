import React, { createContext, useContext, useRef } from 'react';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: any }>;
  attrs?: any;
}

interface Attachment {
  id: string;
  filename: string;
  content: string;
  thumbnail?: string;
  mimeType: string;
}

interface AdfRendererProps {
  doc: any;
  attachments?: Attachment[];
  issueKey?: string; // Jira issue key for proxy URL
}

// Context for tracking media index and issue key for proxy URL
interface MediaContextValue {
  getNextIndex: () => number;
  usedAttachmentIds: Set<string>;
  issueKey?: string;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export function AdfRenderer({ doc, attachments = [], issueKey }: AdfRendererProps) {
  // Use ref to track media index across renders
  const mediaIndexRef = useRef(0);
  const usedAttachmentIds = useRef(new Set<string>());

  // Reset on each render
  mediaIndexRef.current = 0;
  usedAttachmentIds.current = new Set<string>();

  const contextValue: MediaContextValue = {
    getNextIndex: () => mediaIndexRef.current++,
    usedAttachmentIds: usedAttachmentIds.current,
    issueKey,
  };

  if (!doc) {
    return <p className="text-gray-400 italic">No description available</p>;
  }

  if (typeof doc === 'string') {
    return <p>{doc}</p>;
  }

  if (!doc.content || !Array.isArray(doc.content)) {
    return <p className="text-gray-400 italic">No description available</p>;
  }

  return (
    <MediaContext.Provider value={contextValue}>
      <div className="adf-content">
        {doc.content.map((node: AdfNode, idx: number) => (
          <AdfNodeComponent key={idx} node={node} attachments={attachments} />
        ))}
      </div>
    </MediaContext.Provider>
  );
}

function AdfNodeComponent({ node, attachments = [] }: { node: AdfNode; attachments?: Attachment[] }) {
  if (!node) return null;

  switch (node.type) {
    case 'mediaSingle':
      return (
        <div className={`mb-3 ${node.attrs?.layout === 'center' ? 'flex justify-center' : ''}`}>
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </div>
      );

    case 'media':
      return <MediaNode node={node} attachments={attachments} />;

    case 'paragraph': {
      // Check if paragraph contains tree structure (├, └, │, ─)
      const textContent = node.content?.map(c => c.text || '').join('') || '';
      const isTreeStructure = /[├└│─┌┐┘┬┴┼]/.test(textContent);

      if (isTreeStructure) {
        return (
          <pre className="mb-0.5 font-mono text-xs leading-snug whitespace-pre-wrap break-all">
            {node.content?.map((child, idx) => (
              <AdfNodeComponent key={idx} node={child} attachments={attachments} />
            ))}
          </pre>
        );
      }

      return (
        <p className="mb-3 leading-relaxed">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </p>
      );
    }

    case 'text':
      return <TextNode node={node} />;

    case 'heading':
      return <HeadingNode node={node} attachments={attachments} />;

    case 'bulletList':
      return (
        <ul className="list-disc list-inside mb-3 space-y-1 ml-4">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </ol>
      );

    case 'listItem':
      return (
        <li>
          {node.content?.map((child, idx) => {
            // paragraph 노드는 inline으로 렌더링 (줄바꿈 방지)
            if (child.type === 'paragraph') {
              return (
                <span key={idx}>
                  {child.content?.map((innerChild, innerIdx) => (
                    <AdfNodeComponent key={innerIdx} node={innerChild} attachments={attachments} />
                  ))}
                </span>
              );
            }
            return <AdfNodeComponent key={idx} node={child} attachments={attachments} />;
          })}
        </li>
      );

    case 'codeBlock':
      const language = node.attrs?.language || 'text';
      return (
        <pre className="mb-3 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className={`language-${language}`}>
            {node.content?.map((child, idx) => (
              <AdfNodeComponent key={idx} node={child} attachments={attachments} />
            ))}
          </code>
        </pre>
      );

    case 'code':
      return (
        <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
          {node.text}
        </code>
      );

    case 'hardBreak':
      return <br />;

    case 'rule':
      return <hr className="my-4 border-gray-300" />;

    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 mb-3">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </blockquote>
      );

    case 'panel':
      const panelType = node.attrs?.panelType || 'info';
      const panelColors: Record<string, string> = {
        info: 'bg-blue-50 border-blue-200 text-blue-900',
        note: 'bg-purple-50 border-purple-200 text-purple-900',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        error: 'bg-red-50 border-red-200 text-red-900',
        success: 'bg-green-50 border-green-200 text-green-900',
      };
      return (
        <div className={`mb-3 p-4 border-l-4 rounded ${panelColors[panelType] || panelColors.info}`}>
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </div>
      );

    case 'inlineCard':
      const url = node.attrs?.url || '#';
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
        >
          {url}
          <ExternalLink className="w-3 h-3" />
        </a>
      );

    case 'mention':
      return (
        <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm">
          @{node.attrs?.text || 'user'}
        </span>
      );

    case 'emoji':
      return <span>{node.attrs?.shortName || '😊'}</span>;

    case 'table':
      return (
        <div className="mb-3 overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <tbody>
              {node.content?.map((row, idx) => (
                <AdfNodeComponent key={idx} node={row} attachments={attachments} />
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tableRow':
      return (
        <tr className="border-b border-gray-300">
          {node.content?.map((cell, idx) => (
            <AdfNodeComponent key={idx} node={cell} attachments={attachments} />
          ))}
        </tr>
      );

    case 'tableCell':
    case 'tableHeader':
      const Tag = node.type === 'tableHeader' ? 'th' : 'td';
      return (
        <Tag className="border border-gray-300 px-4 py-2 text-left">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </Tag>
      );

    default:
      if (node.content) {
        return (
          <>
            {node.content.map((child, idx) => (
              <AdfNodeComponent key={idx} node={child} attachments={attachments} />
            ))}
          </>
        );
      }
      return null;
  }
}

function MediaNode({ node, attachments }: { node: AdfNode; attachments: Attachment[] }) {
  const mediaContext = useContext(MediaContext);
  const mediaId = node.attrs?.id;
  const collection = node.attrs?.collection || '';
  const width = node.attrs?.width;
  const height = node.attrs?.height;

  // Jira uses various attributes for filename
  const fileName = node.attrs?.__fileName || node.attrs?.alt || node.attrs?.filename || '';
  let displayName = fileName || 'Image';

  // Try multiple matching strategies
  let attachment = attachments.find(att => {
    // Skip already used attachments
    if (mediaContext?.usedAttachmentIds.has(att.id)) return false;

    // 1. Match by __fileName attribute (Jira's internal filename reference)
    if (fileName && att.filename === fileName) return true;

    // 2. Match by filename (case-insensitive)
    if (fileName && att.filename?.toLowerCase() === fileName.toLowerCase()) return true;

    // 3. Match by attachment ID in collection (e.g., "jira-attachment-10001")
    if (collection && att.id) {
      const collectionLower = collection.toLowerCase();
      if (collectionLower.includes(att.id) || collectionLower.includes(`attachment-${att.id}`)) {
        return true;
      }
    }

    // 4. Match if filename contains the other (partial match)
    if (fileName && fileName !== 'Image' && att.filename) {
      if (fileName.includes(att.filename) || att.filename.includes(fileName)) return true;
    }

    return false;
  });

  // 5. Fallback: Try fuzzy match by extension and partial name
  if (!attachment && fileName && fileName !== 'Image') {
    const fileNameLower = fileName.toLowerCase();
    attachment = attachments.find(att => {
      if (mediaContext?.usedAttachmentIds.has(att.id)) return false;
      const attFilenameLower = att.filename?.toLowerCase() || '';
      const fileExt = fileNameLower.split('.').pop();
      const attExt = attFilenameLower.split('.').pop();
      if (fileExt !== attExt) return false;

      const fileBase = fileNameLower.split('.').slice(0, -1).join('.');
      const attBase = attFilenameLower.split('.').slice(0, -1).join('.');
      return attBase.includes(fileBase) || fileBase.includes(attBase);
    });
  }

  // 6. Positional fallback: Use next unused attachment if no match found
  if (!attachment && mediaContext) {
    const mediaIndex = mediaContext.getNextIndex();
    // Find unused attachments (images only)
    const unusedImageAttachments = attachments.filter(att =>
      !mediaContext.usedAttachmentIds.has(att.id) &&
      att.mimeType?.startsWith('image/')
    );

    if (unusedImageAttachments.length > 0) {
      // Use the first unused image attachment
      attachment = unusedImageAttachments[0];
      console.log('[MediaNode] Positional match:', {
        mediaIndex,
        assignedAttachment: attachment.filename
      });
    } else {
      // Debug: No attachments available
      console.log('[MediaNode] No attachments available:', {
        mediaId,
        fileName,
        totalAttachments: attachments.length,
        allAttachments: attachments.map(a => ({ id: a.id, filename: a.filename, mimeType: a.mimeType }))
      });
    }
  }

  // Mark attachment as used
  if (attachment && mediaContext) {
    mediaContext.usedAttachmentIds.add(attachment.id);
    // Update display name if we matched by position
    if (!fileName && attachment.filename) {
      displayName = attachment.filename;
    }
  }

  if (attachment) {
    // Use proxy URL if issueKey is available, otherwise fall back to direct URL
    const imageUrl = mediaContext?.issueKey
      ? `/api/jira/attachment/${mediaContext.issueKey}/${encodeURIComponent(attachment.filename)}`
      : attachment.content;
    const isImage = attachment.mimeType?.startsWith('image/');

    if (isImage) {
      return (
        <div className="mb-3 rounded border border-gray-200 overflow-hidden bg-gray-50" style={{ maxWidth: '100%' }}>
          <img
            src={imageUrl}
            alt={displayName}
            className="h-auto block"
            style={{ maxWidth: '100%', width: width ? `min(${width}px, 100%)` : 'auto' }}
            onError={(e) => {
              // If image fails to load, show placeholder
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="p-8 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                      <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div class="font-medium">${displayName}</div>
                        <div class="text-sm text-gray-400">Image requires authentication</div>
                      </div>
                    </div>
                  </div>
                `;
              }
            }}
          />
        </div>
      );
    } else {
      return (
        <div className="mb-3 p-4 bg-gray-100 rounded border border-gray-200">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-gray-400" />
            <div>
              <div className="font-medium text-gray-700">{attachment.filename}</div>
              <div className="text-sm text-gray-500">{attachment.mimeType}</div>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm underline inline-flex items-center gap-1 mt-1"
              >
                Download
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      );
    }
  }

  // No attachment found - show placeholder
  return (
    <div className="mb-3 p-8 bg-gray-100 rounded border border-gray-200 text-center text-gray-500">
      <div className="flex flex-col items-center gap-2">
        <ImageIcon className="w-12 h-12" />
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-gray-400">Media not available</div>
        </div>
      </div>
    </div>
  );
}

function TextNode({ node }: { node: AdfNode }) {
  let content: React.ReactNode = node.text || '';

  if (node.marks && node.marks.length > 0) {
    node.marks.forEach((mark) => {
      switch (mark.type) {
        case 'strong':
          content = <strong className="font-bold">{content}</strong>;
          break;
        case 'em':
          content = <em className="italic">{content}</em>;
          break;
        case 'underline':
          content = <u>{content}</u>;
          break;
        case 'strike':
          content = <s className="line-through">{content}</s>;
          break;
        case 'code':
          content = (
            <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
              {content}
            </code>
          );
          break;
        case 'link':
          content = (
            <a
              href={mark.attrs?.href || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {content}
            </a>
          );
          break;
        case 'textColor':
          content = (
            <span style={{ color: mark.attrs?.color || 'inherit' }}>
              {content}
            </span>
          );
          break;
      }
    });
  }

  return <>{content}</>;
}

function HeadingNode({ node, attachments }: { node: AdfNode; attachments: Attachment[] }) {
  const level = node.attrs?.level || 1;
  const classes = [
    'text-2xl font-bold mb-3 mt-4',
    'text-xl font-bold mb-3 mt-4',
    'text-lg font-bold mb-2 mt-3',
    'text-base font-bold mb-2 mt-3',
    'text-sm font-bold mb-2 mt-2',
    'text-sm font-bold mb-2 mt-2',
  ];

  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <Tag className={classes[level - 1]}>
      {node.content?.map((child, idx) => (
        <AdfNodeComponent key={idx} node={child} attachments={attachments} />
      ))}
    </Tag>
  );
}
