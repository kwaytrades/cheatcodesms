import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoringMethodEditor from "@/components/cheat-code-ai/ScoringMethodEditor";
import EntryExitRulesEditor from "@/components/cheat-code-ai/EntryExitRulesEditor";
import IndicatorSettingsEditor from "@/components/cheat-code-ai/IndicatorSettingsEditor";
import PresetTemplateManager from "@/components/cheat-code-ai/PresetTemplateManager";

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings & Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Customize how the Trade Analysis Agent scores stocks and manages trades
        </p>
      </div>

      <Tabs defaultValue="scoring" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scoring">Scoring Method</TabsTrigger>
          <TabsTrigger value="entry-exit">Entry/Exit Rules</TabsTrigger>
          <TabsTrigger value="indicators">Indicator Settings</TabsTrigger>
          <TabsTrigger value="presets">Preset Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring">
          <ScoringMethodEditor />
        </TabsContent>

        <TabsContent value="entry-exit">
          <EntryExitRulesEditor />
        </TabsContent>

        <TabsContent value="indicators">
          <IndicatorSettingsEditor />
        </TabsContent>

        <TabsContent value="presets">
          <PresetTemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
