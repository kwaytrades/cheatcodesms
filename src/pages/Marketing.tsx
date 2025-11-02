import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaDatabase } from "./marketing/MediaDatabase";
import { InfluencerCampaigns } from "./marketing/InfluencerCampaigns";
import { InfluencerAnalytics } from "./marketing/InfluencerAnalytics";

export default function Marketing() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketing & PR</h1>
          <p className="text-muted-foreground mt-1">
            Manage influencer outreach, media contacts, and PR campaigns
          </p>
        </div>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="database">Media Database</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <InfluencerCampaigns />
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <MediaDatabase />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <InfluencerAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
