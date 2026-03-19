import type { JSX } from "solid-js";
import logoUrl from "./assets/abel-logo.png";

type Props = {
  size?: number;
  class?: string;
};

export default function AbelLogo(props: Props): JSX.Element {
  const size = props.size ?? 24;
  return (
    <img
      src={logoUrl}
      alt="Abel"
      width={size}
      height={size}
      class={`inline-block ${props.class ?? ""}`}
    />
  );
}
