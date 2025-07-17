export interface PatientFormData {
  name: string;
  age: string;
  gender: string;
  hospital: string;
  diagnosisDate: Date | undefined;
  cancerType: string;
  stage: string;
  surgeryMethod: string;
}

export interface UserProfile {
  email: string;
  role: string;
}

export interface GenerationResponse {
  success: boolean;
  content?: string;
  error?: string;
}