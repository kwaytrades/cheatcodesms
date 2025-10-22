import AIVideoGenerator from "@/components/AIVideoGenerator";

export default function AIVideoGeneration() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Video Generation</h1>
          <p className="text-muted-foreground mt-2">
            Transform your scripts into professional videos using Google Veo 3 AI
          </p>
        </div>
        
        <AIVideoGenerator />
      </div>
    </div>
  );
}
