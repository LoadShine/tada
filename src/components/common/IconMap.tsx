// src/components/common/IconMap.tsx
import * as LucideIcons from "lucide-react";

// Ensure this map includes ALL icons used in the application
export const iconMap = {
    'check-square': LucideIcons.CheckSquare,
    'calendar': LucideIcons.Calendar,
    'search': LucideIcons.Search,
    'user': LucideIcons.User,
    'settings': LucideIcons.Settings, // Used for Appearance/Settings
    'file-text': LucideIcons.FileText,
    'trash': LucideIcons.Trash2,
    'list': LucideIcons.List,
    'grid': LucideIcons.Grid,
    'clock': LucideIcons.Clock,
    'alert-circle': LucideIcons.AlertCircle,
    'plus': LucideIcons.Plus,
    'more-horizontal': LucideIcons.MoreHorizontal,
    'chevron-down': LucideIcons.ChevronDown,
    'chevron-up': LucideIcons.ChevronUp,
    'chevron-left': LucideIcons.ChevronLeft,
    'chevron-right': LucideIcons.ChevronRight,
    'sun': LucideIcons.Sun, // For Today filter / maybe Appearance
    'moon': LucideIcons.Moon, // For Appearance
    'edit': LucideIcons.Edit3, // For placeholder / edit actions
    'check': LucideIcons.Check,
    'x': LucideIcons.X,
    'arrow-left': LucideIcons.ArrowLeft, // For Restore action
    'arrow-right': LucideIcons.ArrowRight,
    'star': LucideIcons.Star,
    'flag': LucideIcons.Flag,
    'tag': LucideIcons.Tag,
    'bell': LucideIcons.Bell,
    'share': LucideIcons.Share2, // For Integrations
    'upload': LucideIcons.UploadCloud, // For Backup/Restore
    'download': LucideIcons.Download, // For Backup/Restore
    'logout': LucideIcons.LogOut,
    'lock': LucideIcons.Lock,
    'tool': LucideIcons.Wrench,
    'layers': LucideIcons.Layers,
    'package': LucideIcons.Package,
    'sliders': LucideIcons.SlidersHorizontal,
    'info': LucideIcons.Info, // For About
    'help': LucideIcons.HelpCircle,
    'phone': LucideIcons.Phone,
    'mail': LucideIcons.Mail,
    'external-link': LucideIcons.ExternalLink,
    'crown': LucideIcons.Crown, // For Premium
    'terminal': LucideIcons.Terminal,
    'grip-vertical': LucideIcons.GripVertical, // For DND handle
    'copy': LucideIcons.Copy,
    'archive': LucideIcons.Archive, // For 'All Tasks' filter
    'arrow-up-down': LucideIcons.ArrowUpDown,
    'calendar-days': LucideIcons.CalendarDays, // For Calendar view icon
    'loader': LucideIcons.Loader2, // Use Loader2 for better spinning animation
    'users': LucideIcons.Users,
    'sparkles': LucideIcons.Sparkles, // For AI Summary icon
    'folder-plus': LucideIcons.FolderPlus, // For Add List action
    // Add any potentially missing icons below:
    'folder': LucideIcons.Folder, // Could be used for Lists section header
    'minus': LucideIcons.Minus, // For collapsing sections maybe?
    'inbox': LucideIcons.Inbox,
};

// Utility type for Icon names based on the map
export type IconName = keyof typeof iconMap;