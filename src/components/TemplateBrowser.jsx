import { useState } from "react";
import {
  FileText,
  FileSignature,
  Home,
  Landmark,
  Unlock,
  Shield,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  File,
  AlertTriangle,
} from "lucide-react";

const iconMap = {
  FileText,
  FileSignature,
  Home,
  Landmark,
  Unlock,
  Shield,
  FolderOpen,
};

function countFiles(node) {
  return (
    node.files.length +
    node.categories.reduce((acc, c) => acc + countFiles(c), 0)
  );
}

export default function TemplateBrowser({
  categories,
  selectedFile,
  onSelectFile,
}) {
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleKey = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getFileExtension = (path) => {
    return path.split(".").pop().toUpperCase();
  };

  const filterNode = (node) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return node;
    const nameMatches = node.name.toLowerCase().includes(q);
    const files = nameMatches
      ? node.files
      : node.files.filter((f) => f.name.toLowerCase().includes(q));
    const cats = node.categories.map(filterNode).filter(Boolean);
    if (files.length === 0 && cats.length === 0 && !nameMatches) return null;
    return { ...node, files, categories: cats };
  };

  const filteredCategories = categories.map(filterNode).filter(Boolean);

  const renderFile = (file, depth, catPath) => {
    const isSelected = selectedFile?.path === file.path;
    const ext = getFileExtension(file.path);
    const isUnsupported = file.unsupported;
    return (
      <button
        key={file.path}
        onClick={() => {
          if (!isUnsupported) {
            onSelectFile({
              ...file,
              category: catPath,
            });
          }
        }}
        title={isUnsupported ? ".doc format not supported in browser. Convert to .docx first." : ""}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
          isUnsupported
            ? "opacity-40 cursor-not-allowed"
            : isSelected
            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
            : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-300"
        }`}
        style={{ paddingLeft: 16 + depth * 14 }}
      >
        {isUnsupported ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
        ) : (
          <File className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="flex-1 truncate">{file.name}</span>
        <span
          className={`text-[10px] px-1 py-0.5 rounded ${
            ext === "DOCX"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          {ext}
        </span>
      </button>
    );
  };

  const renderNode = (node, depth, keyPath) => {
    const Icon = iconMap[node.icon] || FolderOpen;
    const isExpanded = expandedKeys.has(keyPath) || searchQuery;
    const totalFiles = countFiles(node);

    return (
      <div key={keyPath}>
        <button
          onClick={() => toggleKey(keyPath)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-slate-700/50 transition-colors text-left group"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <Icon className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="flex-1 text-slate-300 font-medium truncate">
            {node.name}
          </span>
          <span className="text-xs text-slate-500 mr-1">{totalFiles}</span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {node.categories.map((c) =>
              renderNode(c, depth + 1, `${keyPath}/${c.name}`)
            )}
            {node.files.map((f) => renderFile(f, depth + 1, keyPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50 border-r border-slate-700">
      <div className="p-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Templates
        </h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-md pl-7 pr-3 py-1.5 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredCategories.map((category) =>
          renderNode(category, 0, category.name)
        )}
      </div>

      <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
        {categories.reduce((acc, cat) => acc + countFiles(cat), 0)} templates
        in {categories.length} categories
      </div>
    </div>
  );
}
