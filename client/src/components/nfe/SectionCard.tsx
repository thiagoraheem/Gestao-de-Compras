import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
