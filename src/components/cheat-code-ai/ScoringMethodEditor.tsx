import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw } from "lucide-react";

const DEFAULT_WEIGHTS = {
  trend_strength: 20,
  indicator_alignment: 20,
  volume_confirmation: 15,
  risk_reward_ratio: 20,
  pattern_quality: 15,
  momentum: 10,
};

export default function ScoringMethodEditor() {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const totalPoints = Object.values(weights).reduce((sum, val) => sum + val, 0);
  const isValid = totalPoints === 100;

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
      if (config.weights) {
        setWeights(config.weights);
      }
    }
  };

  const handleWeightChange = (key: string, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isValid) {
      toast({
        title: "Invalid Configuration",
        description: "Total points must equal 100",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { data: currentConfig } = await supabase
      .from("agent_type_configs")
      .select("scoring_config")
      .eq("agent_type", "trade_analysis")
      .single();

    const updatedConfig = {
      ...(currentConfig?.scoring_config as any || {}),
      weights,
    };

    const { error } = await supabase
      .from("agent_type_configs")
      .update({ scoring_config: updatedConfig })
      .eq("agent_type", "trade_analysis");

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save scoring configuration",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Scoring configuration saved successfully",
      });
    }
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  const weightConfig = [
    { key: "trend_strength", label: "Trend Strength", max: 30, description: "Moving average alignment, trend direction" },
    { key: "indicator_alignment", label: "Indicator Alignment", max: 30, description: "RSI, MACD, stochastic convergence" },
    { key: "volume_confirmation", label: "Volume Confirmation", max: 20, description: "Volume vs average, breakout volume" },
    { key: "risk_reward_ratio", label: "Risk/Reward Ratio", max: 30, description: "Distance to stop loss vs profit targets" },
    { key: "pattern_quality", label: "Pattern Quality", max: 20, description: "Chart pattern clarity and reliability" },
    { key: "momentum", label: "Momentum", max: 20, description: "Price momentum, rate of change" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring Method Configuration</CardTitle>
        <CardDescription>
          Customize how stock analyses are scored. Adjust the weight of each factor (total must equal 100 points).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className={isValid ? "border-primary" : "border-destructive"}>
          <AlertDescription className="flex items-center justify-between">
            <span>Total Points: <span className="font-bold">{totalPoints}/100</span></span>
            {!isValid && <span className="text-destructive">Must equal 100</span>}
            {isValid && <span className="text-primary">✓ Valid</span>}
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {weightConfig.map(({ key, label, max, description }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <span className="font-mono text-lg font-bold">{weights[key as keyof typeof weights]} pts</span>
              </div>
              <Slider
                value={[weights[key as keyof typeof weights]]}
                onValueChange={([val]) => handleWeightChange(key, val)}
                max={max}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={!isValid || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
