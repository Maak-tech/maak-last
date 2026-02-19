import React from "react";
import { I18nManager, Text, TextInput } from "react-native";
import i18n from "@/lib/i18n";

type AnyProps = Record<string, unknown>;

const shouldStripCustomFonts = (): boolean =>
  i18n.language === "ar" || I18nManager.isRTL;

const stripCustomFontFamily = (style: unknown): unknown => {
  if (!style || typeof style !== "object") {
    return style;
  }

  if (Array.isArray(style)) {
    let changed = false;
    const next = style.map((entry) => {
      const stripped = stripCustomFontFamily(entry);
      if (stripped !== entry) {
        changed = true;
      }
      return stripped;
    });
    return changed ? next : style;
  }

  const styleObj = style as Record<string, unknown>;
  if (typeof styleObj.fontFamily !== "string") {
    return style;
  }

  // Force platform default Arabic-capable font.
  // Avoid `delete` for performance.
  const { fontFamily: _fontFamily, ...rest } = styleObj;
  return rest;
};

const reactWithPatch = React as typeof React & {
  __maakArabicCreateElementPatched?: boolean;
  __maakOriginalCreateElement?: typeof React.createElement;
};

if (!reactWithPatch.__maakArabicCreateElementPatched) {
  reactWithPatch.__maakArabicCreateElementPatched = true;
  const originalCreateElement = React.createElement;
  reactWithPatch.__maakOriginalCreateElement = originalCreateElement;

  React.createElement = ((
    type: unknown,
    props: AnyProps,
    ...children: unknown[]
  ) => {
    if (!shouldStripCustomFonts()) {
      return originalCreateElement(
        type as never,
        props as never,
        ...(children as never[])
      );
    }

    if (
      (type === Text || type === TextInput) &&
      props &&
      Object.hasOwn(props, "style")
    ) {
      const strippedStyle = stripCustomFontFamily(props.style);
      if (strippedStyle === props.style) {
        return originalCreateElement(
          type as never,
          props as never,
          ...(children as never[])
        );
      }
      const patchedProps = {
        ...props,
        style: strippedStyle,
      };
      return originalCreateElement(
        type as never,
        patchedProps as never,
        ...(children as never[])
      );
    }

    return originalCreateElement(
      type as never,
      props as never,
      ...(children as never[])
    );
  }) as typeof React.createElement;
}

// Keep i18n import for init ordering side effects.
