// Enums
export enum Gender {
  FEMALE = 'FEMALE',
  MALE = 'MALE'
}

export enum Tone {
  FORMAL = 'FORMAL',
  INFORMAL = 'INFORMAL',
  FRIENDLY = 'FRIENDLY'
}

export enum FinancialKnowledgeLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT'
}

export enum TypeAccount {
  Premium = 'Premium',
  Fremium = 'Fremium'
}

// Interfaces
export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  dateOfBirth: Date;
  gender: Gender;
  profession: string;
  aiTonePreference: Tone;
  financialKnowledgeLevel: FinancialKnowledgeLevel;
  accountLocked: boolean;
  failedAttempts: number;
  accountEnabled: boolean;
  accountType: TypeAccount;
  activationCode?: string;
  activationCodeExpiry?: Date;
  createdDate: Date;
  lastModifiedDate: Date;
  deletionRequested: boolean;
  phoneNumber: string;
  updateRequested: boolean;
  firstNameUpdate?: string;
  lastNameUpdate?: string;
  dateOfBirthUpdate?: Date;
  role: Role;
  connexionInformationList: ConnexionInformation[];
}

export interface Role {
  id: number;
  name: string;
  users: User[];
  createdDate: Date;
  lastModifiedDate: Date;
}

export interface ConnexionInformation {
  id: number;
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  internetProvider: string;
  timeZone: string;
  ipAdress: string;
  isVpn: boolean;
  deviceBrand: string;
  deviceName: string;
  deviceType: string;
  operatingSystemVersion: string;
  operatingSystemName: string;
  isApproved: boolean;
  createdDate: Date;
  user: User;
}

// Request/Response Interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: Date;
  gender: Gender;
  profession: string;
  aiTonePreference: Tone;
  financialKnowledgeLevel: FinancialKnowledgeLevel;
  phoneNumber: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  profession?: string;
  aiTonePreference?: Tone;
  financialKnowledgeLevel?: FinancialKnowledgeLevel;
  phoneNumber?: string;
}

export interface ActivationRequest {
  email: string;
  activationCode: string;
}

export interface ResendActivationCodeRequest {
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmationPassword: string;
}

export interface ResetPasswordEmailRequest {
  email: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
  confirmationPassword: string;
}

export interface CompleteProfileRequest {
  profession: string;
  aiTonePreference: Tone;
  financialKnowledgeLevel: FinancialKnowledgeLevel;
  phoneNumber: string;
}

export interface DeletionRequest {
  password: string;
}

export interface UpdateUserByAdminRequest {
  firstNameUpdate?: string;
  lastNameUpdate?: string;
  dateOfBirthUpdate?: Date;
  currentPassword: string;
}

export interface ChatRequest {
  question: string;
}

// Additional DTOs based on your backend controllers
export interface ChangeApprovalRequest {
  id: number;
  value: boolean;
}

export interface RoleRequest {
  roleName: string;
}

export interface UpdateRoleRequest {
  id: number;
  roleName: string;
}