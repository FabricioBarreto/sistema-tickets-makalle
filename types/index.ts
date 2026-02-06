// src/types/index.ts

import { Ticket, User, SystemConfig, Validation } from "@prisma/client";

// ============================================
// Tipos de Usuario y Autenticación
// ============================================

export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================
// Tipos de Tickets/Entradas
// ============================================

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type TicketStatus = "ACTIVE" | "VALIDATED" | "CANCELLED";

export interface TicketWithRelations extends Ticket {
  validatedBy?: User | null;
}

export interface CreateTicketData {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDNI: string;
  quantity: number;
}

export interface TicketFormData extends CreateTicketData {}

export interface TicketFilters {
  search?: string;
  status?: TicketStatus;
  paymentStatus?: PaymentStatus;
  validated?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================
// Tipos de Unicobros
// ============================================

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface MercadoPagoPayment {
  id: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
  external_reference?: string;
  payment_method_id: string;
  payment_type_id: string;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
}

export interface WebhookNotification {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: string;
  user_id: string;
  version: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// ============================================
// Tipos de Validación
// ============================================

export interface ValidateTicketRequest {
  qrCode: string;
}

export interface ValidateTicketResponse {
  success: boolean;
  message: string;
  ticket?: TicketWithRelations;
  alreadyValidated?: boolean;
  validatedAt?: Date;
  validatedByName?: string;
}

export interface ValidationHistory extends Validation {
  ticket: Ticket;
  user: User;
}

// ============================================
// Tipos de Estadísticas y Reportes
// ============================================

export interface DashboardStats {
  totalSold: number;
  totalRevenue: number;
  totalValidated: number;
  totalAvailable: number;
  conversionRate: number;
  averagePerOrder: number;
  mpCommission: number;
  netRevenue: number;
  pendingPayments: number;
}

export interface SalesByDay {
  date: string;
  sales: number;
  revenue: number;
}

export interface SalesByHour {
  hour: number;
  sales: number;
}

export interface ValidationStats {
  totalValidations: number;
  validationRate: number;
  peakHour: number;
  averageTimeToValidation: number;
}

export interface ExportData {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerDNI: string;
  quantity: number;
  price: string;
  totalAmount: string;
  purchaseDate: string;
  paymentStatus: string;
  validated: string;
  validatedAt?: string;
  validatedBy?: string;
  qrCode: string;
}

// ============================================
// Tipos de Configuración
// ============================================

export interface SystemConfigUpdate {
  ticketPrice?: number;
  totalAvailable?: number;
  maxPerPurchase?: number;
  salesEnabled?: boolean;
  eventDate?: Date;
  eventName?: string;
  eventLocation?: string;
  mpAccessToken?: string;
  mpPublicKey?: string;
  emailFrom?: string;
  emailEnabled?: boolean;
}

// ============================================
// Tipos de API Responses
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Tipos de UI Components
// ============================================

export interface DataTableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
}

export interface FilterOption {
  label: string;
  value: string;
}

// ============================================
// Tipos de Errores
// ============================================

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "No autorizado") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

// ============================================
// Tipos de Forms
// ============================================

export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  validation?: {
    pattern?: RegExp;
    message?: string;
  };
}
