// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { twMerge } from 'tailwind-merge';

// Keep the existing IconName type - ADD any new icons used
export type IconName =
    | 'check-square' | 'calendar' | 'search' | 'user' | 'settings' | 'inbox'
    | 'file-text' | 'trash' | 'list' | 'grid' | 'clock' | 'alert-circle'
    | 'plus' | 'more-horizontal' | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
    | 'sun' | 'moon' | 'edit' | 'check' | 'x' | 'arrow-left' | 'arrow-right'
    | 'star' | 'flag' | 'tag' | 'bell' | 'share' | 'upload' | 'download'
    | 'logout' | 'lock' | 'tool' | 'layers' | 'package' | 'sliders' | 'info'
    | 'help' | 'phone' | 'mail' | 'external-link' | 'crown' | 'terminal'
    | 'grip-vertical' | 'copy' | 'archive' | 'arrow-up-down' | 'calendar-days' | 'loader' | 'users'
    | 'sparkles'; // Added sparkles

// Map string names to Lucide components (Case-insensitive matching might be added if needed)
const iconMap: { [key in IconName]: React.ComponentType<LucideIcons.LucideProps> } = {
    'check-square': LucideIcons.CheckSquare,
    'calendar': LucideIcons.Calendar,
    'search': LucideIcons.Search,
    'user': LucideIcons.User,
    'settings': LucideIcons.Settings,
    'inbox': LucideIcons.Inbox,
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
    'sun': LucideIcons.Sun,
    'moon': LucideIcons.Moon,
    'edit': LucideIcons.Edit3,
    'check': LucideIcons.Check,
    'x': LucideIcons.X,
    'arrow-left': LucideIcons.ArrowLeft,
    'arrow-right': LucideIcons.ArrowRight,
    'star': LucideIcons.Star,
    'flag': LucideIcons.Flag,
    'tag': LucideIcons.Tag,
    'bell': LucideIcons.Bell,
    'share': LucideIcons.Share2,
    'upload': LucideIcons.UploadCloud,
    'download': LucideIcons.Download,
    'logout': LucideIcons.LogOut,
    'lock': LucideIcons.Lock,
    'tool': LucideIcons.Wrench,
    'layers': LucideIcons.Layers,
    'package': LucideIcons.Package,
    'sliders': LucideIcons.SlidersHorizontal,
    'info': LucideIcons.Info,
    'help': LucideIcons.HelpCircle,
    'phone': LucideIcons.Phone,
    'mail': LucideIcons.Mail,
    'external-link': LucideIcons.ExternalLink,
    'crown': LucideIcons.Crown,
    'terminal': LucideIcons.Terminal,
    'grip-vertical': LucideIcons.GripVertical,
    'copy': LucideIcons.Copy,
    'archive': LucideIcons.Archive,
    'arrow-up-down': LucideIcons.ArrowUpDown,
    'calendar-days': LucideIcons.CalendarDays,
    'loader': LucideIcons.Loader2, // Use Loader2 for a different spin animation
    'users': LucideIcons.Users,
    'sparkles': LucideIcons.Sparkles, // Added sparkles
};

interface IconProps extends React.SVGAttributes<SVGElement> {
    name: IconName;
    size?: number | string;
    className?: string;
    strokeWidth?: number; // Allow customizing stroke width
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ name, size = '1em', className, strokeWidth = 1.75, ...props }, ref) => { // Default stroke slightly thinner
        const IconComponent = iconMap[name];

        if (!IconComponent) {
            console.warn(`Icon "${name}" not found.`);
            // Return a default placeholder icon to avoid breaking layout
            return <LucideIcons.HelpCircle ref={ref} size={size} className={twMerge('inline-block flex-shrink-0 text-red-500', className)} {...props} />;
        }

        return (
            <IconComponent
                ref={ref}
                size={size}
                // Combine classes: base, passed className
                className={twMerge('inline-block flex-shrink-0 stroke-current', className)}
                strokeWidth={strokeWidth}
                absoluteStrokeWidth={strokeWidth !== 2} // Needed for lucide-react if strokeWidth is not default 2
                {...props}
            />
        );
    }
);
Icon.displayName = 'Icon';
export default Icon;