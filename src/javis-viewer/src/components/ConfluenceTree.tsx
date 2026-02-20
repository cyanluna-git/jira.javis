'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import clsx from 'clsx';
import type { ConfluenceTreeNode, TreeStats, ConfluenceViewMode } from '@/types/confluence';

interface Props {
  selectedPageId?: string;
  onSelectPage: (pageId: string) => void;
  viewMode: ConfluenceViewMode;
  onViewModeChange: (mode: ConfluenceViewMode) => void;
}

export default function ConfluenceTree({
  selectedPageId,
  onSelectPage,
  viewMode,
  onViewModeChange,
}: Props) {
  const [nodes, setNodes] = useState<ConfluenceTreeNode[]>([]);
  const [searchResults, setSearchResults] = useState<ConfluenceTreeNode[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      fetchSearchResults(debouncedSearch);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  // Fetch search results from API
  const fetchSearchResults = async (query: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/confluence/tree?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.nodes || []);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch tree statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/confluence/tree?stats=true');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching tree stats:', error);
    }
  };

  // Fetch root nodes
  const fetchRootNodes = async () => {
    setLoading(true);
    try {
      const includeOrphans = viewMode === 'orphans';
      const res = await fetch(`/api/confluence/tree?parent_id=null&depth=1&include_orphans=${includeOrphans}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes);
      }
    } catch (error) {
      console.error('Error fetching root nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch children for a node
  const fetchChildren = async (parentId: string): Promise<ConfluenceTreeNode[]> => {
    try {
      const res = await fetch(`/api/confluence/tree?parent_id=${parentId}&depth=1`);
      if (res.ok) {
        const data = await res.json();
        return data.nodes;
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    }
    return [];
  };

  // Toggle node expansion
  const toggleExpand = async (node: ConfluenceTreeNode) => {
    const newExpanded = new Set(expandedIds);

    if (expandedIds.has(node.id)) {
      // Collapse
      newExpanded.delete(node.id);
      setExpandedIds(newExpanded);
    } else {
      // Expand - fetch children if needed
      if (node.child_count > 0 && node.children.length === 0) {
        setLoadingIds(prev => new Set(prev).add(node.id));
        const children = await fetchChildren(node.id);

        // Update node with children
        setNodes(prevNodes => updateNodeChildren(prevNodes, node.id, children));
        setLoadingIds(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }

      newExpanded.add(node.id);
      setExpandedIds(newExpanded);
    }
  };

  // Update children in tree structure
  const updateNodeChildren = (
    nodes: ConfluenceTreeNode[],
    parentId: string,
    children: ConfluenceTreeNode[]
  ): ConfluenceTreeNode[] => {
    return nodes.map(node => {
      if (node.id === parentId) {
        return { ...node, children };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodeChildren(node.children, parentId, children) };
      }
      return node;
    });
  };

  useEffect(() => {
    fetchStats();
    fetchRootNodes();
  }, [viewMode]);

  // Determine which nodes to display
  const isSearching = debouncedSearch.trim().length >= 2;
  const displayNodes = isSearching ? searchResults : nodes;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white space-y-3">
        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <ViewModeTab
            mode="tree"
            currentMode={viewMode}
            label="트리"
            count={stats?.total_pages}
            onClick={() => onViewModeChange('tree')}
          />
          <ViewModeTab
            mode="orphans"
            currentMode={viewMode}
            label="고아"
            count={stats?.total_orphans}
            onClick={() => onViewModeChange('orphans')}
            warning={stats?.total_orphans !== undefined && stats.total_orphans > 0}
          />
          <ViewModeTab
            mode="suggestions"
            currentMode={viewMode}
            label="제안"
            onClick={() => onViewModeChange('suggestions')}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="페이지 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{stats.total_pages}개 페이지</span>
            {stats.total_orphans > 0 && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.total_orphans}개 고아
              </span>
            )}
            <span>최대 깊이 {stats.max_depth}</span>
          </div>
        )}
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading || searchLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            {searchLoading ? '검색 중...' : '로딩 중...'}
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>{isSearching ? '검색 결과가 없습니다' : '페이지가 없습니다'}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {isSearching && (
              <div className="text-xs text-gray-500 px-2 py-1 mb-2">
                {displayNodes.length}개 검색 결과
              </div>
            )}
            {displayNodes.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                selectedId={selectedPageId}
                expandedIds={expandedIds}
                loadingIds={loadingIds}
                onSelect={onSelectPage}
                onToggle={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// View Mode Tab Component
interface ViewModeTabProps {
  mode: ConfluenceViewMode;
  currentMode: ConfluenceViewMode;
  label: string;
  count?: number;
  warning?: boolean;
  onClick: () => void;
}

function ViewModeTab({ mode, currentMode, label, count, warning, onClick }: ViewModeTabProps) {
  const isActive = mode === currentMode;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      )}
    >
      <span className="flex items-center justify-center gap-1">
        {label}
        {count !== undefined && (
          <span className={clsx(
            'px-1.5 py-0.5 rounded-full text-[10px]',
            warning ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
          )}>
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

// Tree Node Component
interface TreeNodeProps {
  node: ConfluenceTreeNode;
  level: number;
  selectedId?: string;
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (node: ConfluenceTreeNode) => void;
}

function TreeNode({
  node,
  level,
  selectedId,
  expandedIds,
  loadingIds,
  onSelect,
  onToggle,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isLoading = loadingIds.has(node.id);
  const isSelected = node.id === selectedId;
  const hasChildren = node.child_count > 0;
  const isFolder = node.type === 'folder';

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(node);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={clsx(
          'flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors',
          isSelected
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100 text-gray-700',
          node.is_orphan && !isSelected && 'bg-amber-50'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200 transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
          ) : isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>

        {/* Icon */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )
        ) : (
          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
        )}

        {/* Title */}
        <span className="truncate flex-1">{node.title}</span>

        {/* Orphan Warning */}
        {node.is_orphan && (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        )}

        {/* Child Count Badge */}
        {hasChildren && (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {node.child_count}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
