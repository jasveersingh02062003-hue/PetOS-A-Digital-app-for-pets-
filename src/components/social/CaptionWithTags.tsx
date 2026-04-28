import { Link } from "react-router-dom";

// Renders a caption, turning #hashtags into links to /t/:tag.
export const CaptionWithTags = ({ text, className }: { text: string; className?: string }) => {
  const parts = text.split(/(#[A-Za-z0-9_]{2,30})/g);
  return (
    <p className={className}>
      {parts.map((p, i) => {
        if (p.startsWith("#")) {
          const tag = p.slice(1).toLowerCase();
          return (
            <Link key={i} to={`/t/${tag}`} className="text-primary hover:underline">
              {p}
            </Link>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
};
