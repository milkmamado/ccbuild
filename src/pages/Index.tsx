import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePatientForm } from "@/hooks/usePatientForm";
import { useCharacterGeneration } from "@/hooks/useCharacterGeneration";
import { useCafeContentGeneration } from "@/hooks/useCafeContentGeneration";
import { Header } from "@/components/Header";
import { PatientForm } from "@/components/PatientForm";
import { GeneratedCharacter } from "@/components/GeneratedCharacter";
import { CafeContentGenerator } from "@/components/CafeContentGenerator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile } from "@/types/patient";

const Index = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  
  const {
    formData,
    setFormData,
    handleRandomGenerate,
    resetForm,
    validateForm
  } = usePatientForm();

  const {
    generatedContent,
    isGenerating,
    generateCharacter,
    copyToClipboard,
    clearGeneration
  } = useCharacterGeneration();

  const {
    generatedContent: cafeContent,
    isGenerating: isCafeGenerating,
    generateCafeContent,
    copyToClipboard: copyCafeContent,
    clearGeneration: clearCafeContent
  } = useCafeContentGeneration();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, role')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserProfile(profile);
        }
      }
    } catch (error) {
      console.error('프로필 조회 오류:', error);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "필수 정보 누락",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    await generateCharacter(formData);
  };

  const handleReset = () => {
    clearGeneration();
    resetForm();
  };

  const handleCafeReset = () => {
    clearCafeContent();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Header userProfile={userProfile} />
        
        <Tabs defaultValue="character" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="character">캐릭터 생성</TabsTrigger>
            <TabsTrigger value="cafe">카페 활동 플래닝</TabsTrigger>
          </TabsList>
          
          <TabsContent value="character" className="space-y-6">
            <PatientForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onRandomGenerate={handleRandomGenerate}
              isGenerating={isGenerating}
            />

            <GeneratedCharacter
              content={generatedContent}
              onCopy={copyToClipboard}
              onReset={handleReset}
            />
          </TabsContent>
          
          <TabsContent value="cafe" className="space-y-6">
            <CafeContentGenerator
              onGenerate={generateCafeContent}
              onCopy={copyCafeContent}
              onReset={handleCafeReset}
              generatedContent={cafeContent}
              isGenerating={isCafeGenerating}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;