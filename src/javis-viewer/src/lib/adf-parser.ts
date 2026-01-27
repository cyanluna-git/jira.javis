// Atlassian Document Format (ADF) to plain text converter

export function adfToText(adf: any): string {
  if (!adf) return '';

  // If it's already a string, return it
  if (typeof adf === 'string') return adf;

  // If it's not an object, return empty string
  if (typeof adf !== 'object') return '';

  let text = '';

  // Process content array
  if (adf.content && Array.isArray(adf.content)) {
    text += adf.content.map((node: any) => parseNode(node)).join('\n');
  }

  return text.trim();
}

function parseNode(node: any): string {
  if (!node) return '';

  // Direct text node
  if (node.type === 'text') {
    return node.text || '';
  }

  // Paragraph
  if (node.type === 'paragraph') {
    const content = node.content?.map((n: any) => parseNode(n)).join('') || '';
    return content + '\n';
  }

  // Heading
  if (node.type === 'heading') {
    const level = node.attrs?.level || 1;
    const content = node.content?.map((n: any) => parseNode(n)).join('') || '';
    return '\n' + '#'.repeat(level) + ' ' + content + '\n';
  }

  // Lists
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return node.content?.map((item: any, idx: number) => {
      const bullet = node.type === 'bulletList' ? '• ' : `${idx + 1}. `;
      return bullet + parseNode(item);
    }).join('') || '';
  }

  // List item
  if (node.type === 'listItem') {
    return node.content?.map((n: any) => parseNode(n)).join('') || '';
  }

  // Code block
  if (node.type === 'codeBlock') {
    const content = node.content?.map((n: any) => parseNode(n)).join('') || '';
    return '\n```\n' + content + '\n```\n';
  }

  // Inline card (links)
  if (node.type === 'inlineCard') {
    return node.attrs?.url ? `[${node.attrs.url}]` : '';
  }

  // Media
  if (node.type === 'media') {
    return '[Media]';
  }

  // Mention
  if (node.type === 'mention') {
    return '@' + (node.attrs?.text || 'user');
  }

  // Hard break
  if (node.type === 'hardBreak') {
    return '\n';
  }

  // Rule (horizontal line)
  if (node.type === 'rule') {
    return '\n---\n';
  }

  // Recursively process content if exists
  if (node.content && Array.isArray(node.content)) {
    return node.content.map((n: any) => parseNode(n)).join('');
  }

  return '';
}
