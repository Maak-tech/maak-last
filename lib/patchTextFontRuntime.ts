import React from "react";
import { Text, TextInput } from "react-native";
import i18n from "@/lib/i18n";

type AnyProps = Record<string, unknown>;

const stripCustomFontFamily = (style: unknown): unknown => {
  if (!style) return style;
  if (Array.isArray(style)) return style.map(stripCustomFontFamily);
  if (typeof style !== "object") return style;

  const next = { ...(style as Record<string, unknown>) };
  if (typeof next.fontFamily === "string") {
    // Force platform default Arabic-capable font.
    delete next.fontFamily;
  }
  return next;
};

const reactWithPatch = React as typeof React & {
  __maakArabicCreateElementPatched?: boolean;
  __maakOriginalCreateElement?: typeof React.createElement;
};

if (!reactWithPatch.__maakArabicCreateElementPatched) {
  reactWithPatch.__maakArabicCreateElementPatched = true;
  reactWithPatch.__maakOriginalCreateElement = React.createElement;

  React.createElement = ((
    type: unknown,
    props: AnyProps,
    ...children: unknown[]
  ) => {
    if (
      (type === Text || type === TextInput) &&
      props &&
      Object.hasOwn(props, "style")
    ) {
      const patchedProps = {
        ...props,
        style: stripCustomFontFamily(props.style),
      };
      return reactWithPatch.__maakOriginalCreateElement!(
        type as never,
        patchedProps as never,
        ...(children as never[])
      );
    }

    return reactWithPatch.__maakOriginalCreateElement!(
      type as never,
      props as never,
      ...(children as never[])
    );
  }) as typeof React.createElement;
}

// Keep i18n import for init ordering side effects.
void i18n;
