import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Eye, Users as UsersIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function Users() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const navigate = useNavigate();

  const { data: users, isLoading } = useQuery({
    queryKey: ['cheat-code-users', search, tierFilter],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select(`
          id,
          full_name,
          email,
          phone_number,
          trading_experience,
          trading_style,
          user_subscriptions (
            id,
            tier_id,
            credits_remaining,
            status,
            created_at,
            subscription_tiers (name, price_monthly)
          ),
          stock_analyses (count),
          user_watchlists (count)
        `)
        .not('user_subscriptions', 'is', null);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data?.map(contact => {
        const subscription = Array.isArray(contact.user_subscriptions) ? contact.user_subscriptions[0] : contact.user_subscriptions;
        const tier = subscription?.subscription_tiers;
        
        return {
          id: contact.id,
          name: contact.full_name || 'Unknown',
          email: contact.email,
          phone: contact.phone_number,
          experience: contact.trading_experience,
          style: contact.trading_style,
          tier: tier?.name || 'Unknown',
          tierPrice: tier?.price_monthly || 0,
          credits: subscription?.credits_remaining || 0,
          status: subscription?.status || 'inactive',
          subscriptionStart: subscription?.created_at,
          analysesCount: Array.isArray(contact.stock_analyses) ? contact.stock_analyses.length : 0,
          watchlistCount: Array.isArray(contact.user_watchlists) ? contact.user_watchlists.length : 0,
        };
      }).filter(user => {
        if (tierFilter === 'all') return true;
        return user.tier.toLowerCase() === tierFilter.toLowerCase();
      }) || [];
    }
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'free trial': return 'bg-muted text-muted-foreground';
      case 'basic': return 'bg-info/20 text-info';
      case 'unlimited': return 'bg-warning/20 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary/20 text-primary';
      case 'trial': return 'bg-info/20 text-info';
      case 'expired': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.filter(u => u.status === 'active').length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.filter(u => u.status === 'trial').length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Analysis Users</CardTitle>
          <CardDescription>Manage users subscribed to Cheat Code AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free trial">Free Trial</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="unlimited">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Analyses</TableHead>
                  <TableHead>Watchlist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Member Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">No users found</TableCell>
                  </TableRow>
                ) : (
                  users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTierBadgeColor(user.tier)}>
                          {user.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(user.credits / 100 * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm">{user.credits}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{user.experience || '-'}</span>
                      </TableCell>
                      <TableCell>{user.analysesCount}</TableCell>
                      <TableCell>{user.watchlistCount}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.subscriptionStart ? formatDistanceToNow(new Date(user.subscriptionStart), { addSuffix: true }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/cheat-code-ai/users/${user.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
