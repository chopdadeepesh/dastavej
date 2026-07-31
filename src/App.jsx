import { useState } from "react";
import TemplateBrowser from "./components/TemplateBrowser";
import DocumentEditor from "./components/DocumentEditor";
import { templateCategories } from "./data/templates";
import { FileEdit } from "lucide-react";

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-blue-400" />
          <h1 className="text-base font-bold text-slate-100">
            Dastavej
          </h1>
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">
          Edit Word templates online
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Open Source | React + Vite
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 shrink-0">
          <TemplateBrowser
            categories={templateCategories}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        </div>

        {/* Editor */}
        <DocumentEditor file={selectedFile} />
      </div>
    </div>
  );
}
