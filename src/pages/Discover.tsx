import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/PostFeed";
import { MatesGrid } from "@/components/MatesGrid";

const Discover = () => {
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <h1 className="font-display text-3xl">Discover</h1>
      </header>
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search breeds, pets, services" className="h-12 pl-11 rounded-xl border-hairline bg-card" />
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-muted rounded-xl mb-5">
          <TabsTrigger value="trending" className="rounded-lg">Trending</TabsTrigger>
          <TabsTrigger value="latest" className="rounded-lg">Latest</TabsTrigger>
          <TabsTrigger value="mates" className="rounded-lg">Mates</TabsTrigger>
        </TabsList>

        <TabsContent value="trending" className="pb-10">
          <PostFeed scope="trending" />
        </TabsContent>

        <TabsContent value="latest" className="pb-10">
          <PostFeed scope="all" />
        </TabsContent>

        <TabsContent value="mates" className="pb-10">
          <MatesGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Discover;
