import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllGroups, useMyGroups, useSuggestedGroups } from "@/hooks/useGroups";
import { GroupCard } from "@/components/social/GroupCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const Groups = () => {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const { data: mine } = useMyGroups();
  const { data: suggested } = useSuggestedGroups();
  const { data: all } = useAllGroups(search);

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-2xl">Groups</h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <Tabs defaultValue="suggested">
        <TabsList className="grid grid-cols-3 w-full rounded-xl mb-4">
          <TabsTrigger value="suggested">Suggested</TabsTrigger>
          <TabsTrigger value="mine">Joined</TabsTrigger>
          <TabsTrigger value="all">Browse</TabsTrigger>
        </TabsList>

        <TabsContent value="suggested" className="space-y-3">
          {suggested && suggested.length > 0 ? (
            suggested.map((g) => <GroupCard key={g.id} group={g} />)
          ) : (
            <EmptyState
              icon={Users}
              title="No suggestions yet"
              description="Add a city or interests to your profile to see groups tailored to you."
              ctaLabel="Edit profile"
              onCta={() => nav("/settings/about")}
            />
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3">
          {mine && mine.length > 0 ? (
            mine.map((g) => <GroupCard key={g.id} group={g} />)
          ) : (
            <EmptyState icon={Users} title="No groups yet" description="Join a group to start chatting with like-minded pet parents." />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {(all ?? []).map((g) => <GroupCard key={g.id} group={g} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Groups;
