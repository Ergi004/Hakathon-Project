import {
  Ban, BarChart3, Bell, BookOpen, Download, Eye, FileText, Flag, Gauge, Gavel, Globe, GraduationCap,
  Home, Inbox, KeyRound, LayoutDashboard, List, Lock, Map as MapIcon, Megaphone, Puzzle, Search, Settings, Shield,
  Siren, Target, TriangleAlert, Users, Wand2, type LucideProps,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/nav";

const MAP = {
  home: Home, list: List, file: FileText, bell: Bell, eye: Eye, book: BookOpen, users: Users,
  puzzle: Puzzle, lock: Lock, settings: Settings, layout: LayoutDashboard, wand: Wand2,
  alert: TriangleAlert, flag: Flag, globe: Globe, megaphone: Megaphone, graduation: GraduationCap,
  key: KeyRound, download: Download, gauge: Gauge, inbox: Inbox, gavel: Gavel, chart: BarChart3,
  search: Search, ban: Ban, target: Target, siren: Siren, shield: Shield, map: MapIcon,
} as const;

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = MAP[name];
  return <Icon aria-hidden="true" {...props} />;
}
