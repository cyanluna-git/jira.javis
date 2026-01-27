import React from 'react';
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
}

export function AdfRenderer({ doc, attachments = [] }: AdfRendererProps) {
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
    <div className="adf-content">
      {doc.content.map((node: AdfNode, idx: number) => (
        <AdfNodeComponent key={idx} node={node} attachments={attachments} />
      ))}
    </div>
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

    case 'paragraph':
      return (
        <p className="mb-3 leading-relaxed">
          {node.content?.map((child, idx) => (
            <AdfNodeComponent key={idx} node={child} attachments={attachments} />
          ))}
        </p>
      );

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
        <li className="ml-2">
          {node.content?.map((child, idx) => (
            <span key={idx} className="inline">
              <AdfNodeComponent node={child} attachments={attachments} />
            </span>
          ))}
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
  const mediaId = node.attrs?.id;
  const alt = node.attrs?.alt || 'Image';
  const width = node.attrs?.width;
  const height = node.attrs?.height;

  // Try to find matching attachment by filename (alt usually contains filename)
  const attachment = attachments.find(att => att.filename === alt || att.id === mediaId);

  if (attachment) {
    const imageUrl = attachment.content;
    const isImage = attachment.mimeType?.startsWith('image/');

    if (isImage) {
      return (
        <div className="mb-3 rounded border border-gray-200 overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full h-auto"
            style={width && height ? { maxWidth: width, maxHeight: height } : {}}
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
                        <div class="font-medium">${alt}</div>
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
          <div className="font-medium">{alt}</div>
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
