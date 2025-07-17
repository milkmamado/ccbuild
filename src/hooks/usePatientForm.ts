import { useState, useEffect } from "react";
import { PatientFormData } from "@/types/patient";
import { cancerTypes, stages, hospitals, getSurgeryOptions } from "@/data/medicalData";

export const usePatientForm = () => {
  const [formData, setFormData] = useState<PatientFormData>({
    name: "",
    age: "",
    gender: "",
    hospital: "",
    diagnosisDate: undefined,
    cancerType: "",
    stage: "",
    surgeryMethod: ""
  });

  // 암종이나 병기가 변경되면 수술방법 초기화
  useEffect(() => {
    if (formData.cancerType && formData.stage) {
      const options = getSurgeryOptions(formData.cancerType, formData.stage);
      if (!options.includes(formData.surgeryMethod)) {
        setFormData(prev => ({ ...prev, surgeryMethod: "" }));
      }
    }
  }, [formData.cancerType, formData.stage]);

  const handleRandomGenerate = () => {
    const randomName = ["김미영", "박순례", "최영수", "이정희", "홍길동"][Math.floor(Math.random() * 5)];
    const randomAge = Math.floor(Math.random() * 60) + 30;
    const randomGender = Math.random() > 0.5 ? "여" : "남";
    const randomCancerType = cancerTypes[Math.floor(Math.random() * cancerTypes.length)];
    const randomStage = stages[Math.floor(Math.random() * stages.length)];
    const currentSurgeryOptions = getSurgeryOptions(randomCancerType, randomStage);
    
    setFormData({
      name: randomName,
      age: randomAge.toString(),
      gender: randomGender,
      hospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      diagnosisDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 2) * 24 * 60 * 60 * 1000),
      cancerType: randomCancerType,
      stage: randomStage,
      surgeryMethod: currentSurgeryOptions.length > 0 ? currentSurgeryOptions[Math.floor(Math.random() * currentSurgeryOptions.length)] : ""
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      age: "",
      gender: "",
      hospital: "",
      diagnosisDate: undefined,
      cancerType: "",
      stage: "",
      surgeryMethod: ""
    });
  };

  const validateForm = (): string | null => {
    if (!formData.name || !formData.age || !formData.cancerType) {
      return "이름, 나이, 암종은 필수 입력 항목입니다.";
    }
    return null;
  };

  return {
    formData,
    setFormData,
    handleRandomGenerate,
    resetForm,
    validateForm
  };
};