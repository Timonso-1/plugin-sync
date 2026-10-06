"use client";

// Alle Icons laufen über dieses Client-Modul. lucide-react nutzt intern React-Context,
// und je nach Auflösung (CJS-Build) fehlt dort die "use client"-Direktive, was in
// Server Components zu "createContext only works in Client Components" führt.
export {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileArchive,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PackageCheck,
  PanelLeft,
  Plus,
  Power,
  Puzzle,
  RefreshCw,
  RotateCw,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
