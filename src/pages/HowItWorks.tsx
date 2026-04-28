import { Link } from "react-router-dom";
import { ArrowRight, User, PawPrint, Building2, ShieldCheck, Tag, Baby } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * /how-it-works
 * A plain-English explainer of the PetOS data model:
 * Human profile  →  Pet profiles  →  (optional) Org profile  →  Listings
 */
export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <Badge variant="secondary">How PetOS works</Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            Humans, pets, and organizations — explained
          </h1>
          <p className="text-muted-foreground">
            PetOS has three kinds of profiles. Once you understand them, everything else
            (listings, mating, adoption, donations) makes sense.
          </p>
        </header>

        {/* Visual map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Tile
                icon={<User className="h-5 w-5" />}
                title="Human profile"
                subtitle="profiles table"
                points={[
                  "Created when you sign up",
                  "Has your name, photo, city",
                  "Has account_type: pet_parent, breeder, kennel, shelter, sanctuary, zoo, rescuer",
                ]}
              />
              <Tile
                icon={<PawPrint className="h-5 w-5" />}
                title="Pet profile"
                subtitle="pets table"
                points={[
                  "An animal you own",
                  "One human can own many pets",
                  "Has breed, age, photos, health records",
                ]}
              />
              <Tile
                icon={<Building2 className="h-5 w-5" />}
                title="Org profile"
                subtitle="org_profiles table · optional"
                points={[
                  "Only for breeders, kennels, shelters, sanctuaries, zoos, rescuers",
                  "KYC: registration docs + facility photos",
                  "Admin reviews → approved → verified badge",
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How they connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
{`HUMAN  (profiles)
  ├─ account_type = "breeder"
  ├─ owns →  PET 1   (pets)
  ├─ owns →  PET 2   (pets)
  └─ has  →  ORG     (org_profiles)   ← only if not pet_parent
              ├─ registration docs
              ├─ facility photos
              └─ donation UPI

SELLING / ADOPTING
  PET  →  pet_listings  →  shows seller badge + verified ✓
                       └─ if both parents are PetOS pets:
                           "Bred on PetOS" ribbon`}
            </pre>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="space-y-3">
          <Faq
            q="Do I need to create a pet profile to use PetOS?"
            a="No. A regular pet parent just signs up. You only add a pet when you want to log health, find a mate, or list for adoption."
          />
          <Faq
            q="Do I need an org profile?"
            a="Only if you're a breeder, kennel, shelter, sanctuary, zoo, or rescuer. Pet parents skip it entirely."
          />
          <Faq
            q="What's the difference between account_type on my profile and the org profile?"
            a="account_type is the label ('I'm a breeder'). The org profile is the proof — registration docs, address, photos. You declare your type → fill the org KYC → admin approves → you get the verified badge on listings."
          />
          <Faq
            q="Why is the org profile separate from my human profile?"
            a="Because one human is one person, but an organization has its own identity, address, donations, and verification status. Keeping them separate also lets us show a clean public org page (mission, photos, donate button) without mixing it with personal data."
          />
          <Faq
            q="What is 'Bred on PetOS'?"
            a="If a pet's father (sire) and mother (dam) are both registered as PetOS pets, the puppy's listing automatically gets a lineage ribbon — proof that you can trace its parents inside our system."
          />
        </div>

        {/* Icons row for what you see in marketplace */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What you'll see in the marketplace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
            <Hint icon={<Tag className="h-4 w-4" />} label="Seller badge" desc="Color-coded chip showing breeder, kennel, shelter, etc." />
            <Hint icon={<ShieldCheck className="h-4 w-4" />} label="Verified ✓" desc="Org passed admin KYC review." />
            <Hint icon={<Baby className="h-4 w-4" />} label="Bred on PetOS" desc="Both parents are registered pets in our system." />
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/onboarding/account-type">
              Pick my account type <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/mates">Browse adoption & sale listings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon,
  title,
  subtitle,
  points,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  points: string[];
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <Card>
      <CardContent className="py-4 space-y-1">
        <div className="font-medium">{q}</div>
        <div className="text-sm text-muted-foreground">{a}</div>
      </CardContent>
    </Card>
  );
}

function Hint({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}