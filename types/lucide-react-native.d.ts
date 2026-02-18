/* biome-ignore-all lint/style/useConsistentTypeDefinitions: module augmentation requires interface merging. */
// Module augmentation for lucide-react-native.
// The upstream typings for lucide-react-native currently don't expose the `color`
// prop even though the components accept it at runtime (common usage pattern).

import "lucide-react-native";

declare module "lucide-react-native" {
  interface LucideProps {
    color?: string;
    strokeWidth?: string | number;
  }
}
