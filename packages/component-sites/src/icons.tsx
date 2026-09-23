import type { SiteIconName } from "@ngriffin_uk/polychat-library-sites";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Box,
  Calendar,
  Check,
  CircleHelp,
  Clock,
  Cloud,
  Code2,
  Cpu,
  CreditCard,
  Database,
  Download,
  FileText,
  Gift,
  Globe,
  Heart,
  Home,
  Image,
  Info,
  Layers,
  Link2,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const SITE_ICONS: Record<SiteIconName, LucideIcon> = {
  alert: TriangleAlert,
  "arrow-right": ArrowRight,
  bell: Bell,
  bolt: Zap,
  box: Box,
  calendar: Calendar,
  chart: BarChart3,
  check: Check,
  clock: Clock,
  cloud: Cloud,
  code: Code2,
  cpu: Cpu,
  "credit-card": CreditCard,
  database: Database,
  download: Download,
  file: FileText,
  gift: Gift,
  globe: Globe,
  heart: Heart,
  help: CircleHelp,
  home: Home,
  image: Image,
  info: Info,
  layers: Layers,
  link: Link2,
  lock: Lock,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  message: MessageSquare,
  phone: Phone,
  play: Play,
  plus: Plus,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  upload: Upload,
  users: Users,
  zap: Zap,
};

const SIZES = { sm: 16, md: 20, lg: 28 } as const;

export function SiteIcon({
  name,
  size = "md",
  className,
}: {
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Component = name && name in SITE_ICONS ? SITE_ICONS[name as SiteIconName] : undefined;

  if (!Component) {
    return null;
  }

  return <Component size={SIZES[size]} className={className} aria-hidden="true" />;
}
