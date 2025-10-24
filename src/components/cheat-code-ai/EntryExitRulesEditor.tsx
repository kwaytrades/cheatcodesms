import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2 } from "lucide-react";

interface Target {
  type: string;
  value: number;
  partial_exit?: number;
}

export default function EntryExitRulesEditor() {
  const [entryMethod, setEntryMethod] = useState("support_resistance");
  const [entryConfirmation, setEntryConfirmation] = useState("volume_surge");
  const [stopLossType, setStopLossType] = useState("atr_multiple");
  const [atrMultiplier, setAtrMultiplier] = useState(1.5);
  const [targets, setTargets] = useState<Target[]>([
    { type: "risk_multiple", value: 2, partial_exit: 50 },
    { type: "risk_multiple", value: 3, partial_exit: 25 },
  ]);
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
      const rules = config.entry_exit_rules;
      if (rules) {
        setEntryMethod(rules.entry_method || "support_resistance");
        setEntryConfirmation(rules.entry_confirmation || "volume_surge");
        setStopLossType(rules.stop_loss_type || "atr_multiple");
        setAtrMultiplier(rules.stop_loss_atr_multiplier || 1.5);
        setTargets(rules.targets || targets);
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
      entry_exit_rules: {
        entry_method: entryMethod,
        entry_confirmation: entryConfirmation,
        stop_loss_type: stopLossType,
        stop_loss_atr_multiplier: atrMultiplier,
        targets,
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
        description: "Failed to save entry/exit rules",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Entry/exit rules saved successfully",
      });
    }
  };

  const addTarget = () => {
    setTargets([...targets, { type: "risk_multiple", value: 2, partial_exit: 0 }]);
  };

  const removeTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };

  const updateTarget = (index: number, field: keyof Target, value: any) => {
    const updated = [...targets];
    updated[index] = { ...updated[index], [field]: value };
    setTargets(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entry & Exit Rules</CardTitle>
        <CardDescription>
          Configure your trade entry conditions, stop loss strategy, and profit targets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Entry Method</Label>
            <Select value={entryMethod} onValueChange={setEntryMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support_resistance">Support/Resistance</SelectItem>
                <SelectItem value="support_pullback">Pullback to Support</SelectItem>
                <SelectItem value="breakout">Breakout</SelectItem>
                <SelectItem value="indicator_signal">Indicator Signal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Entry Confirmation</Label>
            <Select value={entryConfirmation} onValueChange={setEntryConfirmation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume_surge">Volume Surge</SelectItem>
                <SelectItem value="candle_pattern">Candle Pattern</SelectItem>
                <SelectItem value="indicator_crossover">Indicator Crossover</SelectItem>
                <SelectItem value="none">No Confirmation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stop Loss Type</Label>
            <Select value={stopLossType} onValueChange={setStopLossType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atr_multiple">ATR Multiple</SelectItem>
                <SelectItem value="fixed_percentage">Fixed Percentage</SelectItem>
                <SelectItem value="support_resistance">Support/Resistance</SelectItem>
                <SelectItem value="swing_low">Swing Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ATR Multiplier</Label>
            <Input
              type="number"
              step="0.1"
              value={atrMultiplier}
              onChange={(e) => setAtrMultiplier(parseFloat(e.target.value))}
              disabled={stopLossType !== "atr_multiple"}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Profit Targets</Label>
            <Button onClick={addTarget} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Target
            </Button>
          </div>

          {targets.map((target, index) => (
            <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Target Type</Label>
                <Select
                  value={target.type}
                  onValueChange={(val) => updateTarget(index, "type", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk_multiple">Risk Multiple</SelectItem>
                    <SelectItem value="fibonacci">Fibonacci Level</SelectItem>
                    <SelectItem value="fixed_percentage">Fixed %</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label className="text-xs">Value</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={target.value}
                  onChange={(e) => updateTarget(index, "value", parseFloat(e.target.value))}
                />
              </div>

              <div className="flex-1 space-y-2">
                <Label className="text-xs">Partial Exit %</Label>
                <Input
                  type="number"
                  value={target.partial_exit || 0}
                  onChange={(e) => updateTarget(index, "partial_exit", parseInt(e.target.value))}
                />
              </div>

              <Button
                onClick={() => removeTarget(index)}
                size="icon"
                variant="ghost"
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Rules
        </Button>
      </CardContent>
    </Card>
  );
}
