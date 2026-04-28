import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/PostFeed";
import { MatesGrid } from "@/components/MatesGrid";
import { SearchBar } from "@/components/SearchBar";

const Discover = () => {
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <h1 className="font-display text-3xl">Discover</h1>
      </header>
      <div className="mb-5">
        <SearchBar />
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
