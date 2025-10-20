import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TradingProfileProps {
  tradingExperience?: string;
  tradingStyle?: string;
  accountSize?: string;
  assetsTraded?: string[];
  riskTolerance?: string;
}

export const TradingProfile = ({
  tradingExperience,
  tradingStyle,
  accountSize,
  assetsTraded = [],
  riskTolerance
}: TradingProfileProps) => {
  if (!tradingExperience && !tradingStyle && !accountSize) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">📊 Trading Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {tradingExperience && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Experience</span>
            <span className="font-medium">{tradingExperience}</span>
          </div>
        )}
        {tradingStyle && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Style</span>
            <span className="font-medium">{tradingStyle}</span>
          </div>
        )}
        {accountSize && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account Size</span>
            <span className="font-medium">{accountSize}</span>
          </div>
        )}
        {assetsTraded.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">Assets</div>
            <div className="flex flex-wrap gap-1">
              {assetsTraded.map((asset, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {asset}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {riskTolerance && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk</span>
            <span className="font-medium">{riskTolerance}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
