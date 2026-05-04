import React from "react";
import { Card } from "@/components/ui/card";
import { 
  ShoppingBag, 
  Heart, 
  MessageSquare, 
  Activity, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const WebDashboard = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-primary text-primary-foreground p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-4 tracking-tight">
            Welcome back to Petos!
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-md">
            Your all-in-one platform for pet discovery, health, and community. Manage everything from one place.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/discover">Explore Marketplace</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" asChild>
              <Link to="/health">Check Health Vault</Link>
            </Button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      </section>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "My Pets", count: 0, icon: Heart, to: "/profile", color: "bg-coral/10 text-coral" },
          { label: "Listings", count: 0, icon: ShoppingBag, to: "/discover", color: "bg-blue-500/10 text-blue-500" },
          { label: "Messages", count: 2, icon: MessageSquare, to: "/messages", color: "bg-green-500/10 text-green-500" },
          { label: "Health Logs", count: 0, icon: Activity, to: "/health", color: "bg-amber-500/10 text-amber-500" },
        ].map((stat, i) => (
          <Link key={i} to={stat.to}>
            <Card className="p-6 hover:shadow-lg transition-all border-hairline group">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl", stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-2xl font-bold">{stat.count}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area: Trends & Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Trending in Marketplace</h2>
            <Link to="/discover" className="text-primary text-sm font-semibold hover:underline">View all</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Placeholder for trending cards */}
             {[1, 2].map((i) => (
               <Card key={i} className="overflow-hidden border-hairline hover:shadow-md transition-all">
                 <div className="aspect-[4/3] bg-muted animate-pulse" />
                 <div className="p-4">
                   <div className="flex items-center gap-2 mb-2">
                     <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">Featured</span>
                   </div>
                   <h3 className="font-semibold mb-1">Golden Retriever Puppy</h3>
                   <p className="text-xs text-muted-foreground mb-4">Mumbai, Maharashtra • 2 months old</p>
                   <div className="flex items-center justify-between">
                     <span className="font-bold">₹45,000</span>
                     <Button size="sm">View Details</Button>
                   </div>
                 </div>
               </Card>
             ))}
          </div>
        </div>

        {/* Sidebar Area: Recommendations & Actions */}
        <div className="space-y-6">
          <Card className="p-6 border-hairline bg-gradient-to-br from-background to-muted/50">
            <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Petos Insights
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Recommended for you</p>
                  <p className="text-xs text-muted-foreground">Based on your recent breed searches.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs" asChild>
                <Link to="/find-my-pet">Take the Matchmaker Quiz</Link>
              </Button>
            </div>
          </Card>

          <Card className="p-6 border-hairline overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="font-display text-lg font-bold mb-2">Professional?</h3>
              <p className="text-xs text-muted-foreground mb-4">List your services as a vet, breeder, or trainer on Petos.</p>
              <Button size="sm" className="w-full">Get Started</Button>
            </div>
            <Plus className="absolute -bottom-4 -right-4 h-24 w-24 text-muted/20 rotate-12" />
          </Card>
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");
