'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';
import IssueRow from './IssueRow';

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  created_at: string;
  raw_data: any;
}

export default function JiraContent({ issues }: { issues: Issue[] }) {
  const [searchKey, setSearchKey] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique projects, components, and versions
  const { projects, components, versions } = useMemo(() => {
    const projectSet = new Set<string>();
    const componentSet = new Set<string>();
    const versionSet = new Set<string>();

    issues.forEach(issue => {
      projectSet.add(issue.project);

      const comps = issue.raw_data?.fields?.components || [];
      comps.forEach((comp: any) => {
        if (comp.name) componentSet.add(comp.name);
      });

      const vers = issue.raw_data?.fields?.fixVersions || [];
      vers.forEach((ver: any) => {
        if (ver.name) versionSet.add(ver.name);
      });
    });

    return {
      projects: Array.from(projectSet).sort(),
      components: Array.from(componentSet).sort(),
      versions: Array.from(versionSet).sort(),
    };
  }, [issues]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search by key
      if (searchKey && !issue.key.toLowerCase().includes(searchKey.toLowerCase())) {
        return false;
      }

      // Filter by project
      if (selectedProjects.length > 0 && !selectedProjects.includes(issue.project)) {
        return false;
      }

      // Filter by component
      if (selectedComponents.length > 0) {
        const issueComponents = (issue.raw_data?.fields?.components || []).map((c: any) => c.name);
        const hasMatchingComponent = selectedComponents.some(comp => issueComponents.includes(comp));
        if (!hasMatchingComponent) return false;
      }

      // Filter by version/sprint
      if (selectedVersions.length > 0) {
        const issueVersions = (issue.raw_data?.fields?.fixVersions || []).map((v: any) => v.name);
        const hasMatchingVersion = selectedVersions.some(ver => issueVersions.includes(ver));
        if (!hasMatchingVersion) return false;
      }

      return true;
    });
  }, [issues, searchKey, selectedProjects, selectedComponents, selectedVersions]);

  const toggleProject = (project: string) => {
    setSelectedProjects(prev =>
      prev.includes(project)
        ? prev.filter(p => p !== project)
        : [...prev, project]
    );
  };

  const toggleComponent = (component: string) => {
    setSelectedComponents(prev =>
      prev.includes(component)
        ? prev.filter(c => c !== component)
        : [...prev, component]
    );
  };

  const toggleVersion = (version: string) => {
    setSelectedVersions(prev =>
      prev.includes(version)
        ? prev.filter(v => v !== version)
        : [...prev, version]
    );
  };

  const clearFilters = () => {
    setSearchKey('');
    setSelectedProjects([]);
    setSelectedComponents([]);
    setSelectedVersions([]);
  };

  const hasActiveFilters = searchKey || selectedProjects.length > 0 || selectedComponents.length > 0 || selectedVersions.length > 0;

  return (
    <>
      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by key (e.g., EUV-3284)"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {(selectedProjects.length + selectedComponents.length + selectedVersions.length) || '•'}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Project Filter */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded"></span>
                  Project
                </h3>
                <div className="space-y-2">
                  {projects.map(project => (
                    <label
                      key={project}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project)}
                        onChange={() => toggleProject(project)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{project}</span>
                      <span className="ml-auto text-sm text-gray-400">
                        ({issues.filter(i => i.project === project).length})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Component Filter */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-purple-500 rounded"></span>
                  Component
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {components.length > 0 ? (
                    components.map(component => {
                      const count = issues.filter(i =>
                        (i.raw_data?.fields?.components || []).some((c: any) => c.name === component)
                      ).length;
                      return (
                        <label
                          key={component}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedComponents.includes(component)}
                            onChange={() => toggleComponent(component)}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-gray-700">{component}</span>
                          <span className="ml-auto text-sm text-gray-400">
                            ({count})
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-gray-400 text-sm italic">No components found</p>
                  )}
                </div>
              </div>

              {/* Version/Sprint Filter */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded"></span>
                  Version/Sprint
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {versions.length > 0 ? (
                    versions.map(version => {
                      const count = issues.filter(i =>
                        (i.raw_data?.fields?.fixVersions || []).some((v: any) => v.name === version)
                      ).length;
                      return (
                        <label
                          key={version}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVersions.includes(version)}
                            onChange={() => toggleVersion(version)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-gray-700 text-sm">{version}</span>
                          <span className="ml-auto text-sm text-gray-400">
                            ({count})
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-gray-400 text-sm italic">No versions found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{filteredIssues.length}</span> of{' '}
            <span className="font-semibold text-gray-700">{issues.length}</span> issues
          </span>
          {hasActiveFilters && (
            <div className="flex gap-2 flex-wrap">
              {searchKey && (
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                  Key: {searchKey}
                </span>
              )}
              {selectedProjects.map(proj => (
                <span key={proj} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  {proj}
                </span>
              ))}
              {selectedComponents.map(comp => (
                <span key={comp} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                  {comp}
                </span>
              ))}
              {selectedVersions.map(ver => (
                <span key={ver} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                  {ver}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-700 w-32">Key</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Summary</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-32">Status</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-24">Project</th>
              <th className="px-6 py-4 font-semibold text-gray-700 w-40">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <IssueRow key={issue.key} issue={issue} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No issues found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
