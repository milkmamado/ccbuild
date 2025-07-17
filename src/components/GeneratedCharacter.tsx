import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Copy, RotateCcw } from "lucide-react";

interface GeneratedCharacterProps {
  content: string;
  onCopy: () => void;
  onReset: () => void;
}

export const GeneratedCharacter = ({ content, onCopy, onReset }: GeneratedCharacterProps) => {
  if (!content) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          생성된 캐릭터
        </CardTitle>
        <CardDescription>
          AI가 생성한 암환자 캐릭터 정보입니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button onClick={onCopy} variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            복사
          </Button>
          <Button onClick={onReset} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            새로 생성
          </Button>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {content}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};