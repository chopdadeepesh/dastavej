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

export default function TemplateBrowser({
  categories,
  selectedFile,
  onSelectFile,
}) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      files: cat.files.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.files.length > 0 || !searchQuery);

  const toggleCategory = (name) => {
    setExpandedCategory(expandedCategory === name ? null : name);
  };

  const getFileExtension = (path) => {
    return path.split(".").pop().toUpperCase();
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
        {filteredCategories.map((category) => {
          const Icon = iconMap[category.icon] || FolderOpen;
          const isExpanded =
            expandedCategory === category.name || searchQuery;

          return (
            <div key={category.name}>
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-slate-700/50 transition-colors text-left group"
              >
                <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1 text-slate-300 font-medium">
                  {category.name}
                </span>
                <span className="text-xs text-slate-500 mr-1">
                  {category.files.length}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 space-y-0.5 mt-0.5">
                  {category.files.map((file) => {
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
                              category: category.name,
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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
        {categories.reduce((acc, cat) => acc + cat.files.length, 0)} templates
        in {categories.length} categories
      </div>
    </div>
  );
}
