import { siDiscord, siGithub } from "simple-icons";

type IconProps = { size?: number; className?: string };

function BrandIcon({ path, size = 18, className }: IconProps & { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={path} />
    </svg>
  );
}

export const GithubIcon = (props: IconProps) => <BrandIcon path={siGithub.path} {...props} />;
export const DiscordIcon = (props: IconProps) => <BrandIcon path={siDiscord.path} {...props} />;
