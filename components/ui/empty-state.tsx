import { Card, CardContent } from "./card";

interface EmptyStateProps {
  icon: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-5xl mb-3">{icon}</div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{title}</h2>
        {text && (
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto whitespace-pre-line">
            {text}
          </p>
        )}
        {action && <div className="flex justify-center">{action}</div>}
      </CardContent>
    </Card>
  );
}
