import { Link } from "react-router-dom";

export const LegalLayout = ({ title, lastUpdated, children }: {
  title: string; lastUpdated: string; children: React.ReactNode;
}) => (
  <div className="min-h-screen bg-background">
    <div className="container-app py-10 max-w-2xl">
      <Link to="/" className="text-xs uppercase tracking-wide text-muted-foreground">← Petos</Link>
      <h1 className="font-display text-3xl mt-6 mb-2">{title}</h1>
      <div className="hairline w-12 mb-3" />
      <p className="text-xs text-muted-foreground mb-8">Last updated: {lastUpdated}</p>
      <div className="prose prose-sm max-w-none text-foreground space-y-4 leading-relaxed text-sm">
        {children}
      </div>
      <div className="mt-12 pt-6 hairline-t flex gap-4 text-xs text-muted-foreground">
        <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
        <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/legal/refunds" className="hover:text-foreground">Refunds</Link>
      </div>
    </div>
  </div>
);
