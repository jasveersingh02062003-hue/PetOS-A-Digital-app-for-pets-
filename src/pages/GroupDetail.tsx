import { useParams, useNavigate } from "react-router-dom";
import { useGroupBySlug, useIsMember, useToggleMembership, useGroupPosts, useGroupMembers } from "@/hooks/useGroups";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import { PostGrid } from "@/components/social/PostGrid";
import { EmptyState } from "@/components/EmptyState";

const GroupDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { data: group, isLoading } = useGroupBySlug(slug);
  const { data: isMember } = useIsMember(group?.id);
  const toggle = useToggleMembership();
  const { data: posts } = useGroupPosts(group?.id);
  const { data: members } = useGroupMembers(group?.id);

  if (isLoading) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Loading…</div>;
  if (!group) return <div className="container-app pad-top-safe pt-10 text-muted-foreground">Group not found.</div>;

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">
          {group.kind === "breed" ? "Breed" : group.kind === "city" ? "City" : "Interest"}
        </span>
      </header>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 mb-4">
        <h1 className="font-display text-3xl">{group.name}</h1>
        {group.description && <p className="text-sm text-muted-foreground mt-2">{group.description}</p>}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {group.member_count} members
          </div>
          <Button
            size="sm"
            variant={isMember ? "outline" : "default"}
            className="rounded-full"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ groupId: group.id, isMember: !!isMember })}
          >
            {isMember ? "Joined" : "Join group"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="posts">
        <TabsList className="grid grid-cols-2 w-full rounded-xl mb-4">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {posts && posts.length > 0 ? (
            <PostGrid posts={posts} />
          ) : (
            <EmptyState icon={Users} title="No posts yet" description="Be the first to share something with this group." />
          )}
        </TabsContent>

        <TabsContent value="members">
          <div className="text-sm text-muted-foreground">{(members ?? []).length} member{(members?.length ?? 0) === 1 ? "" : "s"}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GroupDetail;
