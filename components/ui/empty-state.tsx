import { Card, CardContent } from "./card";

interface EmptyStateProps {
  icon: string | React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center animate-fade-in-up">
        <div className="mb-4 flex justify-center">
          {typeof icon === "string" ? (
            <div className="text-5xl">{icon}</div>
          ) : (
            <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">{title}</h2>
        {text && (
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto whitespace-pre-line">
            {text}
          </p>
        )}
        {action && <div className="flex justify-center">{action}</div>}
      </CardContent>
    </Card>
  );
}
