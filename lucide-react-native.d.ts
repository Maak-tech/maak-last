// Type declarations for lucide-react-native
// This fixes TypeScript errors where color and size props are not recognized

declare module "lucide-react-native" {
  import type { SvgProps } from "react-native-svg";

  export interface LucideProps extends Omit<SvgProps, "color"> {
    color?: string;
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = React.ComponentType<LucideProps>;

  export const Activity: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Bell: LucideIcon;
  export const Calendar: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Clock: LucideIcon;
  export const FileText: LucideIcon;
  export const Plus: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const X: LucideIcon;
  // Add other icons as needed
}
