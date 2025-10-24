import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Phone, TrendingUp, Target, Calendar, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function UserDetail() {
  const { id } = useParams();

  const { data: user, isLoading } = useQuery({
    queryKey: ['cheat-code-user', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          user_subscriptions (
            *,
            subscription_tiers (*)
          ),
          stock_analyses (*),
          user_watchlists (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const subscription = Array.isArray(user?.user_subscriptions) ? user.user_subscriptions[0] : user?.user_subscriptions;
  const tier = subscription?.subscription_tiers;

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6">User not found</div>;
  }

  const getTierBadgeColor = (tierName: string) => {
    switch (tierName?.toLowerCase()) {
      case 'free trial': return 'bg-muted text-muted-foreground';
      case 'basic': return 'bg-info/20 text-info';
      case 'unlimited': return 'bg-warning/20 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - User Profile */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/20 text-primary text-lg">
                    {user.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{user.full_name || 'Unknown User'}</CardTitle>
                  <CardDescription>Trade Analysis User</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{user.phone_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email || 'No email'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Tier</span>
                <Badge className={getTierBadgeColor(tier?.name)}>
                  {tier?.name || 'Unknown'}
                </Badge>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Credits Remaining</span>
                  <span className="font-bold">{subscription?.credits_remaining || 0}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary"
                    style={{ width: `${Math.min((subscription?.credits_remaining || 0) / 100 * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge className={subscription?.status === 'active' ? 'bg-primary/20 text-primary' : 'bg-muted'}>
                  {subscription?.status || 'inactive'}
                </Badge>
              </div>
              {tier?.price_monthly && tier.price_monthly > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Price</span>
                  <span className="font-bold">${tier.price_monthly}</span>
                </div>
              )}
              <Button className="w-full" size="sm">Manage Subscription</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trading Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Experience</span>
                <span className="capitalize font-medium">{user.trading_experience || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trading Style</span>
                <span className="capitalize font-medium">{user.trading_style || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account Size</span>
                <span className="font-medium">{user.account_size || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Risk Tolerance</span>
                <span className="capitalize font-medium">{user.risk_tolerance || 'Not set'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm">Total Analyses</span>
                </div>
                <span className="font-bold">{user.stock_analyses?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-info" />
                  <span className="text-sm">Watchlist Items</span>
                </div>
                <span className="font-bold">{user.user_watchlists?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Member Since</span>
                </div>
                <span className="text-sm">
                  {subscription?.created_at ? formatDistanceToNow(new Date(subscription.created_at), { addSuffix: true }) : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center and Right Panels - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="analyses" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analyses">Stock Analyses</TabsTrigger>
              <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
            </TabsList>

            <TabsContent value="analyses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Stock Analyses</CardTitle>
                  <CardDescription>All stock analyses performed by this user</CardDescription>
                </CardHeader>
                <CardContent>
                  {user.stock_analyses?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No analyses yet</p>
                  ) : (
                    <div className="space-y-4">
                      {user.stock_analyses?.slice(0, 10).map((analysis: any) => (
                        <div key={analysis.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono text-lg">{analysis.symbol}</span>
                            <Badge className={
                              analysis.sentiment === 'bullish' ? 'bg-primary/20 text-primary' :
                              analysis.sentiment === 'bearish' ? 'bg-destructive/20 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }>
                              {analysis.sentiment}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Technical Score: </span>
                              <span className="font-bold">{analysis.technical_score || 0}/100</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Setup: </span>
                              <span className="capitalize">{analysis.setup_type || 'N/A'}</span>
                            </div>
                          </div>
                          {analysis.entry_price && (
                            <div className="text-sm space-y-1">
                              <div><span className="text-muted-foreground">Entry:</span> ${analysis.entry_price}</div>
                              <div><span className="text-muted-foreground">Stop Loss:</span> ${analysis.stop_loss}</div>
                              <div><span className="text-muted-foreground">Targets:</span> ${analysis.target1}, ${analysis.target2}</div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(analysis.requested_at), { addSuffix: true })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="watchlist" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Watchlist</CardTitle>
                  <CardDescription>User's active watchlist items</CardDescription>
                </CardHeader>
                <CardContent>
                  {user.user_watchlists?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No watchlist items</p>
                  ) : (
                    <div className="space-y-3">
                      {user.user_watchlists?.map((item: any) => (
                        <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="font-bold font-mono">{item.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              Target: ${item.target_price} • Stop: ${item.stop_loss}
                            </div>
                          </div>
                          <Badge className={
                            item.status === 'watching' ? 'bg-info/20 text-info' :
                            item.status === 'triggered' ? 'bg-primary/20 text-primary' :
                            'bg-muted text-muted-foreground'
                          }>
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Conversation History</CardTitle>
                  <CardDescription>SMS conversations with Cheat Code AI</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Conversation view coming soon
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
