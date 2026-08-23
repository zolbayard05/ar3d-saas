import type { DetailedHTMLProps, HTMLAttributes } from "react";

// @google/model-viewer registers a custom element but ships no React JSX
// typings. Augmenting react's own JSX.IntrinsicElements (rather than the
// bare global JSX namespace) is what actually resolves under this project's
// "jsx": "react-jsx" + React 19 types.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        "ios-src"?: string;
        alt?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        scale?: string;
        poster?: string;
        "shadow-intensity"?: string | number;
        loading?: "auto" | "lazy" | "eager";
        reveal?: "auto" | "interaction" | "manual";
      };
    }
  }
}
