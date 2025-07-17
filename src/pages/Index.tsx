import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePatientForm } from "@/hooks/usePatientForm";
import { useCharacterGeneration } from "@/hooks/useCharacterGeneration";
import { Header } from "@/components/Header";
import { PatientForm } from "@/components/PatientForm";
import { GeneratedCharacter } from "@/components/GeneratedCharacter";
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Header userProfile={userProfile} />
        
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
      </div>
    </div>
  );
};

export default Index;