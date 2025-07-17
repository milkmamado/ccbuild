import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CafeContentGeneratorProps {
  onGenerate: (characterContent: string) => Promise<boolean>;
  onCopy: () => void;
  onReset: () => void;
  generatedContent: string;
  isGenerating: boolean;
}

export const CafeContentGenerator = ({
  onGenerate,
  onCopy,
  onReset,
  generatedContent,
  isGenerating
}: CafeContentGeneratorProps) => {
  const [characterInput, setCharacterInput] = useState("");
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!characterInput.trim()) {
      toast({
        title: "입력 필요",
        description: "캐릭터 정보를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    await onGenerate(characterInput);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>네이버 암 카페 활동 플래닝 생성기</CardTitle>
          <CardDescription>
            생성된 캐릭터 정보를 입력하면 네이버 암 카페에서 활용할 수 있는 다양한 게시글 아이디어와 완성된 콘텐츠를 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="character-input" className="text-sm font-medium mb-2 block">
              생성된 캐릭터 정보 입력
            </label>
            <Textarea
              id="character-input"
              placeholder="위에서 생성된 캐릭터 정보 전체를 붙여넣기 해주세요..."
              value={characterInput}
              onChange={(e) => setCharacterInput(e.target.value)}
              rows={8}
              className="min-h-[200px]"
            />
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={isGenerating || !characterInput.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                카페 활동 플래닝 생성 중...
              </>
            ) : (
              "카페 활동 플래닝 생성하기"
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>생성된 카페 활동 플래닝</CardTitle>
                <CardDescription>
                  네이버 암 카페에서 활용할 수 있는 콘텐츠가 생성되었습니다.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onCopy}>
                  <Copy className="h-4 w-4 mr-1" />
                  복사
                </Button>
                <Button variant="outline" size="sm" onClick={onReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  초기화
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {generatedContent}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};