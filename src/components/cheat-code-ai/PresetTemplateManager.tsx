import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload } from "lucide-react";

const PRESET_TEMPLATES = {
  cheat_code: {
    name: "Cheat Code Method",
    description: "Original Cheat Code trading methodology",
    config: {
      methodology: "cheat_code",
      weights: {
        trend_strength: 20,
        indicator_alignment: 20,
        volume_confirmation: 15,
        risk_reward_ratio: 20,
        pattern_quality: 15,
        momentum: 10,
      },
      setup_preferences: {
        breakout: { enabled: true, min_score: 70, priority: 1 },
        reversal: { enabled: true, min_score: 75, priority: 2 },
      },
    },
  },
  day_trading: {
    name: "Day Trading Scalper",
    description: "Fast-paced intraday trading focused on momentum",
    config: {
      methodology: "day_trading",
      weights: {
        momentum: 30,
        volume_confirmation: 25,
        indicator_alignment: 20,
        trend_strength: 15,
        pattern_quality: 5,
        risk_reward_ratio: 5,
      },
      setup_preferences: {
        momentum: { enabled: true, min_score: 65, priority: 1 },
        breakout: { enabled: true, min_score: 70, priority: 2 },
      },
    },
  },
  swing_trading: {
    name: "Swing Trading",
    description: "Multi-day position trades with strong patterns",
    config: {
      methodology: "swing_trading",
      weights: {
        pattern_quality: 25,
        trend_strength: 25,
        risk_reward_ratio: 20,
        indicator_alignment: 15,
        volume_confirmation: 10,
        momentum: 5,
      },
      setup_preferences: {
        reversal: { enabled: true, min_score: 75, priority: 1 },
        consolidation: { enabled: true, min_score: 70, priority: 2 },
      },
    },
  },
  conservative: {
    name: "Conservative/Risk-Averse",
    description: "High probability setups with strong confirmations",
    config: {
      methodology: "conservative",
      weights: {
        risk_reward_ratio: 30,
        pattern_quality: 25,
        trend_strength: 20,
        indicator_alignment: 15,
        volume_confirmation: 10,
        momentum: 0,
      },
      setup_preferences: {
        breakout: { enabled: true, min_score: 80, priority: 1 },
        reversal: { enabled: true, min_score: 85, priority: 2 },
      },
    },
  },
};

export default function PresetTemplateManager() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadPreset = async (presetKey: string) => {
    setIsLoading(true);
    const preset = PRESET_TEMPLATES[presetKey as keyof typeof PRESET_TEMPLATES];

    const { data: currentConfig } = await supabase
      .from("agent_type_configs")
      .select("scoring_config")
      .eq("agent_type", "trade_analysis")
      .single();

    const updatedConfig = {
      ...(currentConfig?.scoring_config as any || {}),
      ...preset.config,
    };

    const { error } = await supabase
      .from("agent_type_configs")
      .update({ scoring_config: updatedConfig })
      .eq("agent_type", "trade_analysis");

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load preset",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Preset Loaded",
        description: `${preset.name} configuration applied successfully`,
      });
      window.location.reload(); // Refresh to show new config
    }
  };

  const exportConfig = async () => {
    const { data } = await supabase
      .from("agent_type_configs")
      .select("scoring_config")
      .eq("agent_type", "trade_analysis")
      .single();

    if (data?.scoring_config) {
      const blob = new Blob([JSON.stringify(data.scoring_config, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scoring-config-${Date.now()}.json`;
      a.click();
      toast({
        title: "Config Exported",
        description: "Configuration downloaded as JSON file",
      });
    }
  };

  const importConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      try {
        const config = JSON.parse(text);
        const { error } = await supabase
          .from("agent_type_configs")
          .update({ scoring_config: config })
          .eq("agent_type", "trade_analysis");

        if (error) throw error;

        toast({
          title: "Config Imported",
          description: "Configuration loaded successfully",
        });
        window.location.reload();
      } catch (err) {
        toast({
          title: "Import Failed",
          description: "Invalid configuration file",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preset Templates</CardTitle>
          <CardDescription>
            Load pre-configured scoring methodologies or manage your custom configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => (
            <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">{preset.name}</h4>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
              </div>
              <Button onClick={() => loadPreset(key)} disabled={isLoading} variant="outline">
                Load Preset
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import/Export Configuration</CardTitle>
          <CardDescription>
            Save your configuration as JSON or load a previously exported config
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={exportConfig} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Config
          </Button>
          <Button onClick={importConfig} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Config
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
