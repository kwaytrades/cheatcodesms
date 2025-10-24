import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function IndicatorSettingsEditor() {
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [volumeThreshold, setVolumeThreshold] = useState(1.5);
  const [useVolumeProfile, setUseVolumeProfile] = useState(true);
  const [smaPeriods, setSmaPeriods] = useState([20, 50, 200]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentConfig();
  }, []);

  const loadCurrentConfig = async () => {
    const { data, error } = await supabase
      .from("agent_type_configs")
      .select("scoring_config")
      .eq("agent_type", "trade_analysis")
      .single();

    if (!error && data?.scoring_config) {
      const config = data.scoring_config as any;
      const settings = config.indicator_settings;
      if (settings) {
        setRsiPeriod(settings.rsi_period || 14);
        setRsiOverbought(settings.rsi_overbought || 70);
        setRsiOversold(settings.rsi_oversold || 30);
        setMacdFast(settings.macd_fast || 12);
        setMacdSlow(settings.macd_slow || 26);
        setMacdSignal(settings.macd_signal || 9);
        setVolumeThreshold(settings.volume_threshold || 1.5);
        setUseVolumeProfile(settings.use_volume_profile !== false);
        setSmaPeriods(settings.sma_periods || [20, 50, 200]);
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    const { data: currentConfig } = await supabase
      .from("agent_type_configs")
      .select("scoring_config")
      .eq("agent_type", "trade_analysis")
      .single();

    const updatedConfig = {
      ...(currentConfig?.scoring_config as any || {}),
      indicator_settings: {
        rsi_period: rsiPeriod,
        rsi_overbought: rsiOverbought,
        rsi_oversold: rsiOversold,
        macd_fast: macdFast,
        macd_slow: macdSlow,
        macd_signal: macdSignal,
        volume_threshold: volumeThreshold,
        use_volume_profile: useVolumeProfile,
        sma_periods: smaPeriods,
      },
    };

    const { error } = await supabase
      .from("agent_type_configs")
      .update({ scoring_config: updatedConfig })
      .eq("agent_type", "trade_analysis");

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save indicator settings",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Indicator settings saved successfully",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Indicator Settings</CardTitle>
        <CardDescription>
          Configure technical indicator parameters for analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">RSI (Relative Strength Index)</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Period</Label>
              <Input
                type="number"
                value={rsiPeriod}
                onChange={(e) => setRsiPeriod(parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Overbought Level</Label>
              <Input
                type="number"
                value={rsiOverbought}
                onChange={(e) => setRsiOverbought(parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Oversold Level</Label>
              <Input
                type="number"
                value={rsiOversold}
                onChange={(e) => setRsiOversold(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">MACD</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fast Period</Label>
              <Input
                type="number"
                value={macdFast}
                onChange={(e) => setMacdFast(parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slow Period</Label>
              <Input
                type="number"
                value={macdSlow}
                onChange={(e) => setMacdSlow(parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Signal Period</Label>
              <Input
                type="number"
                value={macdSignal}
                onChange={(e) => setMacdSignal(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Volume & Moving Averages</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Volume Threshold Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                value={volumeThreshold}
                onChange={(e) => setVolumeThreshold(parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Volume must be X times above average
              </p>
            </div>
            <div className="space-y-2">
              <Label>SMA Periods (comma-separated)</Label>
              <Input
                value={smaPeriods.join(", ")}
                onChange={(e) => setSmaPeriods(e.target.value.split(",").map(s => parseInt(s.trim())))}
                placeholder="20, 50, 200"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={useVolumeProfile}
              onCheckedChange={setUseVolumeProfile}
            />
            <Label>Use Volume Profile Analysis</Label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
