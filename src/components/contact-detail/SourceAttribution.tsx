import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SourceAttributionProps {
  leadSource?: string;
  utmCampaign?: string;
  referrer?: string;
  createdAt: string;
}

export const SourceAttribution = ({
  leadSource,
  utmCampaign,
  referrer,
  createdAt
}: SourceAttributionProps) => {
  if (!leadSource && !utmCampaign && !referrer) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">📍 Source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {leadSource && (
          <div>
            <div className="font-medium">{leadSource}</div>
          </div>
        )}
        {utmCampaign && (
          <div className="text-muted-foreground">{utmCampaign}</div>
        )}
        {referrer && (
          <div className="text-muted-foreground text-xs">{referrer}</div>
        )}
        <div className="text-xs text-muted-foreground pt-1">
          First: {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </CardContent>
    </Card>
  );
};
