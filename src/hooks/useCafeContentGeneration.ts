import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCafeContentGeneration = () => {
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateCafeContent = async (characterContent: string): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "로그인 필요",
          description: "로그인 후 이용해주세요.",
          variant: "destructive",
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('generate-cafe-content', {
        body: { characterContent },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedContent(data.content);
        toast({
          title: "카페 활동 플래닝 생성 완료",
          description: "네이버 암 카페 활동 콘텐츠가 성공적으로 생성되었습니다.",
        });
        return true;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('카페 콘텐츠 생성 오류:', error);
      const errorMessage = error.message || "카페 활동 플래닝 생성 중 오류가 발생했습니다.";
      toast({
        title: "생성 실패",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({
      title: "복사 완료",
      description: "생성된 카페 활동 플래닝이 클립보드에 복사되었습니다.",
    });
  };

  const clearGeneration = () => {
    setGeneratedContent("");
  };

  return {
    generatedContent,
    isGenerating,
    generateCafeContent,
    copyToClipboard,
    clearGeneration
  };
};