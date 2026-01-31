import { BookOpen, MousePointer2, Dumbbell, TrendingUp } from "lucide-react";
import heroImage from "@/assets/images/hero-learning.png";

export default function Home() {
  const steps = [
    {
      icon: BookOpen,
      title: "Choose a text",
      description: "Pick a topic from the sidebar to start learning"
    },
    {
      icon: MousePointer2,
      title: "Study",
      description: "Read, listen, and tap words for translations"
    },
    {
      icon: Dumbbell,
      title: "Practice",
      description: "Test yourself with interactive exercises"
    },
    {
      icon: TrendingUp,
      title: "Track progress",
      description: "See your completion status for each text"
    }
  ];

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 sm:px-8">
      <div className="space-y-3 mb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-foreground">
          LingoFlow
        </h1>
        <p className="text-lg text-muted-foreground">
          Read. Listen. Practice.
        </p>
      </div>

      <div className="mb-10 relative">
        <img 
          src={heroImage} 
          alt="German language learning" 
          className="w-full h-48 sm:h-56 object-cover rounded-xl"
          style={{
            maskImage: "radial-gradient(ellipse 90% 80% at center, black 50%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at center, black 50%, transparent 100%)"
          }}
        />
      </div>

      <div className="bg-card border rounded-xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-semibold mb-6 text-foreground text-center">How it works</h2>
        
        <div className="grid gap-5 sm:grid-cols-2">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-muted-foreground text-sm mt-8">
        Select a text from the sidebar to begin.
      </p>
    </div>
  );
}
